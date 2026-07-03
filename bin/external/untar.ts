// A minimal streaming tar.gz extractor for the archives GitHub, GitLab,
// Bitbucket and Codeberg serve. Handles the ustar + pax shapes they emit:
// regular files, directories and symlinks, with pax extended headers ('x'/'g')
// for long paths. Throws on anything else (hardlinks, GNU long-link, unknown
// typeflags) so the caller can fall back to the clone path. The gzip is streamed
// and only one entry's bytes are buffered at a time, so memory stays bounded by
// the largest single file rather than the whole archive.

import fs from "node:fs"
import path from "node:path"
import type { Readable } from "node:stream"
import { createGunzip } from "node:zlib"

const BLOCK = 512

const readString = (buf: Buffer, off: number, len: number) => {
  let end = off
  const limit = off + len
  while (end < limit && buf[end] !== 0) end++
  return buf.toString("utf8", off, end)
}

// An octal numeric field, space/NUL padded.
const readOctal = (buf: Buffer, off: number, len: number) => {
  const s = readString(buf, off, len).trim()
  return s ? parseInt(s, 8) : 0
}

type Header = { name: string; size: number; type: string; linkname: string; mode: number }

// Returns null for an all-zero block (the archive's end marker).
const parseHeader = (block: Buffer): Header | null => {
  let zero = true
  for (let i = 0; i < BLOCK; i++) {
    if (block[i] !== 0) {
      zero = false
      break
    }
  }
  if (zero) return null
  const name = readString(block, 0, 100)
  const prefix = readString(block, 345, 155)
  return {
    name: prefix ? `${prefix}/${name}` : name,
    size: readOctal(block, 124, 12),
    type: String.fromCharCode(block[156]),
    linkname: readString(block, 157, 100),
    mode: readOctal(block, 100, 8),
  }
}

// Parse pax "<length> key=value\n" records into a map.
const parsePax = (data: Buffer): Record<string, string> => {
  const out: Record<string, string> = {}
  const text = data.toString("utf8")
  let i = 0
  while (i < text.length) {
    const sp = text.indexOf(" ", i)
    if (sp < 0) break
    const len = Number.parseInt(text.slice(i, sp), 10)
    if (!Number.isFinite(len) || len <= 0) break
    const record = text.slice(sp + 1, i + len - 1) // drop the trailing "\n"
    const eq = record.indexOf("=")
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1)
    i += len
  }
  return out
}

// Extract a gzipped tar stream into destDir, dropping the first `strip` leading
// path components (archive hosts wrap everything in one top-level dir).
export const extractTarGz = async (
  source: Readable,
  destDir: string,
  strip = 1,
): Promise<{ files: number; symlinks: number }> => {
  let files = 0
  let symlinks = 0
  let pax: Record<string, string> = {}

  const writeEntry = async (header: Header, data: Buffer) => {
    const name = pax.path ?? header.name
    const linkname = pax.linkpath ?? header.linkname
    pax = {}

    const rel = name.split("/").slice(strip).join("/")
    if (!rel) return // the stripped top-level dir itself
    const outPath = path.join(destDir, rel)

    if (header.type === "5") {
      await fs.promises.mkdir(outPath, { recursive: true })
    } else if (header.type === "2") {
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true })
      try {
        await fs.promises.symlink(linkname, outPath)
        symlinks++
      } catch {
        // Match copy-dir: warn on a failed symlink (e.g. Windows) but keep going.
        console.warn(`Warning: could not create symlink ${rel} -> ${linkname}`)
      }
    } else if (header.type === "0" || header.type === "\0" || header.type === "") {
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true })
      // Preserve the file mode (e.g. an executable 0755) like a checkout does,
      // rather than defaulting to the umask; git archives store 0644/0755.
      await fs.promises.writeFile(outPath, data, { mode: header.mode & 0o777 || 0o644 })
      files++
    } else {
      throw new Error(`untar: unsupported entry type '${header.type}' for ${rel}`)
    }
  }

  const consume = async (h: Header, data: Buffer) => {
    if (h.type === "x" || h.type === "g") pax = { ...pax, ...parsePax(data) }
    else await writeEntry(h, data)
  }

  // Accumulate gunzip output as a list of chunks with a running length and copy
  // out only the bytes we consume (a 512-byte header, then the entry's padded
  // data). A single growing `Buffer.concat` per chunk would be O(n^2) on a repo
  // with one large blob; this keeps each byte copied O(1) times.
  const parts: Buffer[] = []
  let pending = 0

  // Remove and return the first `n` bytes from the accumulated chunks.
  const take = (n: number): Buffer => {
    const out = Buffer.allocUnsafe(n)
    let filled = 0
    while (filled < n) {
      const c = parts[0]
      const copy = Math.min(c.length, n - filled)
      c.copy(out, filled, 0, copy)
      filled += copy
      if (copy === c.length) parts.shift()
      else parts[0] = c.subarray(copy)
    }
    pending -= n
    return out
  }

  let header: Header | null = null
  let need = BLOCK // bytes required for the next step: a header, then its data

  for await (const chunk of source.pipe(createGunzip())) {
    parts.push(chunk as Buffer)
    pending += (chunk as Buffer).length
    while (pending >= need) {
      if (header === null) {
        const h = parseHeader(take(BLOCK))
        if (!h) continue // end-of-archive zero block
        const padded = Math.ceil(h.size / BLOCK) * BLOCK
        if (padded === 0) {
          await consume(h, Buffer.alloc(0)) // dir/symlink/empty file: no data section
        } else {
          header = h
          need = padded // wait for the data
        }
      } else {
        const block = take(need)
        await consume(header, block.subarray(0, header.size))
        header = null
        need = BLOCK
      }
    }
  }

  return { files, symlinks }
}
