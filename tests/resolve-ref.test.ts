import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { resolveRefFromClone, resolveRefFromRemote } from "../bin/utils/resolve-ref"
import { configFromUrl } from "../bin/utils/transform-url"

// --- resolveRefFromClone against a real repo with slash branches ---

describe("resolveRefFromClone anchors slash branches", () => {
  let repo: string
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gitpick-ref-test-"))
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" })
    git("init", "-q")
    git("config", "user.email", "test@example.com")
    git("config", "user.name", "Test")
    git("commit", "--allow-empty", "-q", "-m", "init")
    git("branch", "-M", "main")
    git("branch", "feat/marketing-assets-gitpick")
    git("branch", "feat/data-table")
    // git forbids a branch `feat` alongside `feat/*` (ref dir/file conflict), so
    // a branch can never be a path-prefix of another branch. A tag lives in a
    // separate namespace, so `feat` (tag) can coexist and lets us prove the
    // longest matching ref wins over a shorter one.
    git("tag", "feat")
    git("tag", "v1.0/rc1") // a tag whose name contains a slash
  })
  afterAll(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it("matches a slash branch with no sub-path", async () => {
    expect(await resolveRefFromClone(repo, ["feat", "marketing-assets-gitpick"])).toEqual({
      branch: "feat/marketing-assets-gitpick",
      path: "",
    })
  })

  it("splits a slash branch from its sub-path", async () => {
    expect(
      await resolveRefFromClone(repo, ["feat", "marketing-assets-gitpick", "src", "app.ts"]),
    ).toEqual({ branch: "feat/marketing-assets-gitpick", path: "src/app.ts" })
  })

  it("prefers the longest matching ref", async () => {
    // both the `feat` tag and the `feat/marketing-assets-gitpick` branch exist —
    // the longer ref wins so the sub-path is not swallowed into the branch
    expect(await resolveRefFromClone(repo, ["feat", "marketing-assets-gitpick"])).toEqual({
      branch: "feat/marketing-assets-gitpick",
      path: "",
    })
    // `feat/readme.md` is not a ref, so it falls back to the shorter `feat` tag
    expect(await resolveRefFromClone(repo, ["feat", "readme.md"])).toEqual({
      branch: "feat",
      path: "readme.md",
    })
  })

  it("keeps a single-segment branch with its path", async () => {
    expect(await resolveRefFromClone(repo, ["main", "folder", "deep"])).toEqual({
      branch: "main",
      path: "folder/deep",
    })
  })

  it("resolves a slash tag", async () => {
    expect(await resolveRefFromClone(repo, ["v1.0", "rc1", "example"])).toEqual({
      branch: "v1.0/rc1",
      path: "example",
    })
  })

  it("returns null when no ref matches (e.g. a commit SHA)", async () => {
    expect(await resolveRefFromClone(repo, ["8af536b", "folder"])).toBeNull()
    expect(await resolveRefFromClone(repo, [])).toBeNull()
  })
})

// --- configFromUrl exposes the raw ref+path segments ---
// Pure string parsing — tree/blob URLs never hit the network, so these run
// offline. The branch names are illustrative; the point is the split.

describe("configFromUrl exposes refSegments for tree/blob URLs", () => {
  it("github tree", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/feat/new-ui", {})
    expect(c.branch).toBe("feat")
    expect(c.path).toBe("new-ui")
    expect(c.refSegments).toEqual(["feat", "new-ui"])
  })

  it("github blob", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/blob/feat/new-ui/file.txt", {})
    expect(c.refSegments).toEqual(["feat", "new-ui", "file.txt"])
  })

  it("github tree with no sub-path", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/main", {})
    expect(c.refSegments).toEqual(["main"])
  })

  it("gitlab tree", async () => {
    const c = await configFromUrl("https://gitlab.com/group/proj/-/tree/release/2.0/src", {})
    expect(c.branch).toBe("release")
    expect(c.path).toBe("2.0/src")
    expect(c.refSegments).toEqual(["release", "2.0", "src"])
  })

  it("bitbucket src", async () => {
    const c = await configFromUrl("https://bitbucket.org/owner/repo/src/feature/x/dir", {})
    expect(c.refSegments).toEqual(["feature", "x", "dir"])
  })

  it("codeberg src/branch", async () => {
    const c = await configFromUrl("https://codeberg.org/owner/repo/src/branch/feat/x/dir", {})
    expect(c.refSegments).toEqual(["feat", "x", "dir"])
  })

  it("omits refSegments when -b is explicit", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/feat/new-ui", { branch: "main" })
    expect(c.branch).toBe("main")
    expect(c.refSegments).toBeUndefined()
  })

  it("omits refSegments for repository URLs", async () => {
    // -b avoids the default-branch network lookup for the repository type
    const c = await configFromUrl("nrjdalal/picksuite", { branch: "main" })
    expect(c.type).toBe("repository")
    expect(c.refSegments).toBeUndefined()
  })
})

// --- resolveRefFromRemote against the real picksuite remote (ls-remote) ---

describe("resolveRefFromRemote (picksuite)", () => {
  const URL = "https://github.com/nrjdalal/picksuite"

  it("prefers branch release/1.0 over the shadowing tag release", async () => {
    expect(await resolveRefFromRemote(URL, ["release", "1.0", "folder"])).toEqual({
      branch: "release/1.0",
      path: "folder",
    })
  }, 30000)

  it("resolves the slash branch feat/nested", async () => {
    expect(await resolveRefFromRemote(URL, ["feat", "nested"])).toEqual({
      branch: "feat/nested",
      path: "",
    })
  }, 30000)

  it("returns null for a commit SHA that is not a ref", async () => {
    expect(await resolveRefFromRemote(URL, ["8af536b", "folder"])).toBeNull()
  }, 30000)
})
