import { afterEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { fetchRawBlob, rawBlobUrl } from "../bin/utils/raw-blob"

// A valid GitHub blob config; override single fields per case.
const cfg = (over: Record<string, unknown> = {}) => ({
  host: "github.com",
  owner: "nrjdalal",
  repository: "picksuite",
  branch: "main",
  path: "file.txt",
  ...over,
})

const tmp = () => mkdtempSync(join(tmpdir(), "gp-raw-"))

// =====================================================================
// rawBlobUrl — pure URL construction, no network
// =====================================================================

describe("rawBlobUrl — per-host endpoints", () => {
  it("github → raw.githubusercontent.com/{o}/{r}/{ref}/{path}", () => {
    expect(rawBlobUrl(cfg())).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/main/file.txt",
    )
  })

  it("gitlab → /-/raw/{ref}/{path}", () => {
    expect(
      rawBlobUrl(
        cfg({ host: "gitlab.com", owner: "pages", repository: "plain-html", path: "README.md" }),
      ),
    ).toBe("https://gitlab.com/pages/plain-html/-/raw/main/README.md")
  })

  it("codeberg → auto-resolving /raw/{ref}/, NOT /raw/branch/", () => {
    // Regression guard: /raw/branch/{ref} 404s for a tag or commit ref; the
    // kind-less /raw/{ref}/ form 303-redirects to branch|tag|commit, which
    // fetch follows. Keep the branchless shape.
    const url = rawBlobUrl(
      cfg({ host: "codeberg.org", owner: "Codeberg", repository: "avatars", path: "README.md" }),
    )
    expect(url).toBe("https://codeberg.org/Codeberg/avatars/raw/main/README.md")
    expect(url).not.toContain("/raw/branch/")
  })

  it("bitbucket → null (no blob type ever reaches the fast path)", () => {
    // Regression guard: transform-url types every bitbucket /src/ path as a
    // tree, so a bitbucket file uses the clone path. A raw URL here would be
    // unreachable dead code.
    expect(rawBlobUrl(cfg({ host: "bitbucket.org", owner: "o", repository: "r" }))).toBeNull()
  })

  it("unknown host → null", () => {
    expect(rawBlobUrl(cfg({ host: "git.example.com" }))).toBeNull()
  })
})

describe("rawBlobUrl — path & ref handling", () => {
  it("empty path → null", () => {
    expect(rawBlobUrl(cfg({ path: "" }))).toBeNull()
  })

  it("preserves nested path segments", () => {
    expect(rawBlobUrl(cfg({ path: "folder/deep/file.txt" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/main/folder/deep/file.txt",
    )
  })

  it("keeps a slash in the ref as a separator (slash branch)", () => {
    expect(rawBlobUrl(cfg({ branch: "feat/nested", path: "on-nested.txt" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/feat/nested/on-nested.txt",
    )
  })

  it("accepts a commit SHA as the ref", () => {
    expect(rawBlobUrl(cfg({ branch: "8af536b", path: "file.txt" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/8af536b/file.txt",
    )
  })

  it("URL-encodes spaces in a segment but keeps the slash", () => {
    expect(rawBlobUrl(cfg({ path: "my docs/read me.md" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/main/my%20docs/read%20me.md",
    )
  })

  it("URL-encodes reserved characters (# ? %)", () => {
    expect(rawBlobUrl(cfg({ path: "a#b/c?d/100%.txt" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/main/a%23b/c%3Fd/100%25.txt",
    )
  })

  it("URL-encodes unicode segments", () => {
    expect(rawBlobUrl(cfg({ path: "café/naïve.txt" }))).toBe(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/main/caf%C3%A9/na%C3%AFve.txt",
    )
  })

  it("URL-encodes owner and repository", () => {
    expect(rawBlobUrl(cfg({ owner: "a b", repository: "c+d" }))).toBe(
      "https://raw.githubusercontent.com/a%20b/c%2Bd/main/file.txt",
    )
  })
})

// =====================================================================
// fetchRawBlob — short-circuits and fetch handling (fetch mocked)
// =====================================================================

describe("fetchRawBlob — short-circuits without touching the network", () => {
  it("returns null for an unsupported host (never calls fetch)", async () => {
    const spy = mock(() => Promise.reject(new Error("should not fetch")))
    const real = globalThis.fetch
    globalThis.fetch = spy as unknown as typeof fetch
    try {
      expect(await fetchRawBlob(cfg({ host: "bitbucket.org" }), join(tmp(), "x"))).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = real
    }
  })

  it("returns null for an empty path (never calls fetch)", async () => {
    const spy = mock(() => Promise.reject(new Error("should not fetch")))
    const real = globalThis.fetch
    globalThis.fetch = spy as unknown as typeof fetch
    try {
      expect(await fetchRawBlob(cfg({ path: "" }), join(tmp(), "x"))).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = real
    }
  })
})

describe("fetchRawBlob — fetch handling", () => {
  const real = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = real
  })

  it("writes the body and reports its byte size on 200", async () => {
    globalThis.fetch = mock(async () => new Response("hello world")) as unknown as typeof fetch
    const dir = tmp()
    const target = join(dir, "out.txt")
    const res = await fetchRawBlob(cfg(), target)
    expect(res).not.toBeNull()
    expect(res!.size).toBe(11)
    expect(typeof res!.networkTime).toBe("number")
    expect(typeof res!.copyTime).toBe("number")
    expect(readFileSync(target, "utf8")).toBe("hello world")
    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null and writes nothing on a 404", async () => {
    globalThis.fetch = mock(
      async () => new Response("Not Found", { status: 404 }),
    ) as unknown as typeof fetch
    const dir = tmp()
    const target = join(dir, "out.txt")
    expect(await fetchRawBlob(cfg(), target)).toBeNull()
    expect(existsSync(target)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null on any 5xx", async () => {
    globalThis.fetch = mock(
      async () => new Response("boom", { status: 503 }),
    ) as unknown as typeof fetch
    const dir = tmp()
    expect(await fetchRawBlob(cfg(), join(dir, "out.txt"))).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it("returns null when fetch throws (network error)", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("ENOTFOUND")
    }) as unknown as typeof fetch
    const dir = tmp()
    expect(await fetchRawBlob(cfg(), join(dir, "out.txt"))).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it("creates missing parent directories for the target", async () => {
    globalThis.fetch = mock(async () => new Response("x")) as unknown as typeof fetch
    const dir = tmp()
    const target = join(dir, "a", "b", "c.txt")
    await fetchRawBlob(cfg(), target)
    expect(readFileSync(target, "utf8")).toBe("x")
    rmSync(dir, { recursive: true, force: true })
  })

  it("writes binary content byte-for-byte", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 254, 128, 10, 13])
    globalThis.fetch = mock(async () => new Response(bytes)) as unknown as typeof fetch
    const dir = tmp()
    const target = join(dir, "out.bin")
    const res = await fetchRawBlob(cfg(), target)
    expect(res!.size).toBe(bytes.length)
    expect([...readFileSync(target)]).toEqual([...bytes])
    rmSync(dir, { recursive: true, force: true })
  })
})
