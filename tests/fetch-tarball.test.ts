import { describe, expect, it, mock } from "bun:test"

import { archiveUrl, fetchTarball, type TarballConfig } from "../bin/utils/fetch-tarball"

const cfg = (over: Record<string, string> = {}): TarballConfig =>
  ({
    host: "github.com",
    owner: "nrjdalal",
    repository: "picksuite",
    branch: "main",
    ...over,
  }) as TarballConfig

describe("archiveUrl — per host", () => {
  it("github → codeload tar.gz", () => {
    expect(archiveUrl(cfg())).toBe("https://codeload.github.com/nrjdalal/picksuite/tar.gz/main")
  })

  it("gitlab → /-/archive/{ref}.tar.gz", () => {
    expect(archiveUrl(cfg({ host: "gitlab.com", owner: "pages", repository: "plain-html" }))).toBe(
      "https://gitlab.com/pages/plain-html/-/archive/main.tar.gz",
    )
  })

  it("bitbucket → /get/{ref}.tar.gz", () => {
    expect(archiveUrl(cfg({ host: "bitbucket.org", owner: "o", repository: "r" }))).toBe(
      "https://bitbucket.org/o/r/get/main.tar.gz",
    )
  })

  it("codeberg → /archive/{ref}.tar.gz", () => {
    expect(
      archiveUrl(cfg({ host: "codeberg.org", owner: "Codeberg", repository: "avatars" })),
    ).toBe("https://codeberg.org/Codeberg/avatars/archive/main.tar.gz")
  })

  it("unknown host → null", () => {
    expect(archiveUrl(cfg({ host: "git.example.com" }))).toBeNull()
  })

  it("accepts a commit SHA ref", () => {
    expect(archiveUrl(cfg({ branch: "8af536b" }))).toBe(
      "https://codeload.github.com/nrjdalal/picksuite/tar.gz/8af536b",
    )
  })

  it("keeps a slash in the ref", () => {
    expect(archiveUrl(cfg({ branch: "release/1.0" }))).toBe(
      "https://codeload.github.com/nrjdalal/picksuite/tar.gz/release/1.0",
    )
  })

  it("URL-encodes owner and repository", () => {
    expect(archiveUrl(cfg({ owner: "a b", repository: "c d" }))).toBe(
      "https://codeload.github.com/a%20b/c%20d/tar.gz/main",
    )
  })
})

describe("fetchTarball — short-circuit", () => {
  it("returns false for an unknown host without fetching", async () => {
    const spy = mock(() => Promise.reject(new Error("should not fetch")))
    const real = globalThis.fetch
    globalThis.fetch = spy as unknown as typeof fetch
    try {
      expect(await fetchTarball(cfg({ host: "git.example.com" }), "/tmp/nope")).toBe(false)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = real
    }
  })
})
