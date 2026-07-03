import { describe, expect, it } from "bun:test"
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { gzipSync } from "node:zlib"

import { extractTarGz } from "../bin/external/untar"

// --- a minimal tar builder (no system tar, no network) ---

function header(name: string, size: number, type: string, linkname = "", mode = 0o644): Buffer {
  const h = Buffer.alloc(512)
  h.write(name, 0, "utf8")
  h.write(mode.toString(8).padStart(7, "0") + "\0", 100, "ascii")
  h.write(size.toString(8).padStart(11, "0") + "\0", 124, "ascii")
  h.write(type, 156, "ascii")
  if (linkname) h.write(linkname, 157, "utf8")
  // checksum: sum of all bytes with the checksum field treated as spaces
  for (let i = 148; i < 156; i++) h[i] = 0x20
  let sum = 0
  for (let i = 0; i < 512; i++) sum += h[i]
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii")
  return h
}

function entry(name: string, content = "", type = "0", linkname = "", mode = 0o644): Buffer {
  if (type === "5" || type === "2") return header(name, 0, type, linkname, mode)
  const data = Buffer.from(content)
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512)
  data.copy(padded)
  return Buffer.concat([header(name, data.length, type, "", mode), padded])
}

// A pax 'x' extended header carrying a "path=<long>" record for the next entry.
// A pax record is "<total> <body>" where <total> is the record's own byte length
// including the digits of <total> itself, so solve for it iteratively.
function paxPath(longPath: string): Buffer {
  const body = `path=${longPath}\n`
  let total = body.length + 2
  while (String(total).length + 1 + body.length !== total) {
    total = String(total).length + 1 + body.length
  }
  const data = Buffer.from(`${total} ${body}`)
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512)
  data.copy(padded)
  return Buffer.concat([header("pax_ext", data.length, "x"), padded])
}

async function extract(...parts: Buffer[]) {
  const tar = Buffer.concat([...parts, Buffer.alloc(1024)]) // two zero end blocks
  const gz = gzipSync(tar)
  const dir = mkdtempSync(join(tmpdir(), "untar-"))
  const stats = await extractTarGz(Readable.from(gz), dir)
  return { dir, stats }
}

// =====================================================================

describe("extractTarGz", () => {
  it("extracts files and nested dirs, stripping the top-level dir", async () => {
    const { dir, stats } = await extract(
      entry("repo-main/", "", "5"),
      entry("repo-main/file.txt", "hello"),
      entry("repo-main/dir/", "", "5"),
      entry("repo-main/dir/nested.txt", "nested"),
    )
    expect(readFileSync(join(dir, "file.txt"), "utf8")).toBe("hello")
    expect(readFileSync(join(dir, "dir/nested.txt"), "utf8")).toBe("nested")
    expect(existsSync(join(dir, "repo-main"))).toBe(false) // stripped
    expect(stats.files).toBe(2)
    rmSync(dir, { recursive: true, force: true })
  })

  it("recreates symlinks (not regular files)", async () => {
    const { dir, stats } = await extract(
      entry("repo-main/", "", "5"),
      entry("repo-main/file.txt", "target"),
      entry("repo-main/link.txt", "", "2", "file.txt"),
    )
    expect(lstatSync(join(dir, "link.txt")).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(dir, "link.txt"))).toBe("file.txt")
    expect(stats.symlinks).toBe(1)
    rmSync(dir, { recursive: true, force: true })
  })

  it("creates a parent dir for a file even without an explicit dir entry", async () => {
    const { dir } = await extract(
      entry("repo-main/", "", "5"),
      entry("repo-main/a/b/c.txt", "deep"),
    )
    expect(readFileSync(join(dir, "a/b/c.txt"), "utf8")).toBe("deep")
    rmSync(dir, { recursive: true, force: true })
  })

  it("preserves binary content byte-for-byte", async () => {
    const bytes = Buffer.from([0, 1, 2, 255, 254, 10, 13])
    const { dir } = await extract(
      entry("repo-main/", "", "5"),
      Buffer.concat([
        header("repo-main/x.bin", bytes.length, "0"),
        (() => {
          const p = Buffer.alloc(512)
          bytes.copy(p)
          return p
        })(),
      ]),
    )
    expect([...readFileSync(join(dir, "x.bin"))]).toEqual([...bytes])
    rmSync(dir, { recursive: true, force: true })
  })

  it("applies a pax 'path' override to the following entry (long names)", async () => {
    const long = "repo-main/" + "d/".repeat(60) + "leaf.txt" // > 100 chars
    const { dir } = await extract(
      entry("repo-main/", "", "5"),
      paxPath(long),
      entry("repo-main/short-truncated-name", "long-content"),
    )
    const rel = long.split("/").slice(1).join("/")
    expect(readFileSync(join(dir, rel), "utf8")).toBe("long-content")
    rmSync(dir, { recursive: true, force: true })
  })

  // The Unix exec bit does not exist on Windows (writeFile's mode is a no-op
  // there), so this guarantee is POSIX-only.
  it.skipIf(process.platform === "win32")(
    "preserves the executable bit from the tar mode",
    async () => {
      const { dir } = await extract(
        entry("repo-main/", "", "5"),
        entry("repo-main/run.sh", "#!/bin/sh\necho hi\n", "0", "", 0o755),
        entry("repo-main/plain.txt", "data", "0", "", 0o644),
      )
      expect(statSync(join(dir, "run.sh")).mode & 0o111).not.toBe(0) // some exec bit
      expect(statSync(join(dir, "plain.txt")).mode & 0o111).toBe(0) // no exec bit
      rmSync(dir, { recursive: true, force: true })
    },
  )

  it("throws on an unsupported entry type so the caller can fall back", async () => {
    // typeflag '1' = hardlink, which the untar does not handle
    await expect(
      extract(entry("repo-main/", "", "5"), entry("repo-main/hard", "", "1", "file.txt")),
    ).rejects.toThrow(/unsupported entry type/)
  })
})
