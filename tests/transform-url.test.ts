import { describe, expect, it } from "bun:test"

import { configFromUrl } from "../bin/utils/transform-url"

// configFromUrl only touches the network (getDefaultBranch) for a `repository`
// URL with no branch. Every case below is either a tree/blob/raw/commit URL or
// passes `-b`, so the whole file runs offline and fast.

// =====================================================================
// GitHub
// =====================================================================

describe("configFromUrl — github", () => {
  it("shorthand repo (with -b to stay offline)", async () => {
    const c = await configFromUrl("nrjdalal/picksuite", { branch: "main" })
    // token is intentionally not asserted here: configFromUrl picks up a
    // GITHUB_TOKEN/GH_TOKEN env var for github, so its value is environment
    // dependent (covered separately with an explicit inline token below).
    expect(c).toMatchObject({
      host: "github.com",
      owner: "nrjdalal",
      repository: "picksuite",
      type: "repository",
      branch: "main",
      path: "",
      target: "picksuite",
    })
  })

  it("full URL repo", async () => {
    const c = await configFromUrl("https://github.com/nrjdalal/picksuite", { branch: "main" })
    expect(c).toMatchObject({ host: "github.com", type: "repository", repository: "picksuite" })
  })

  it("strips a .git suffix", async () => {
    const c = await configFromUrl("https://github.com/nrjdalal/picksuite.git", { branch: "main" })
    expect(c.repository).toBe("picksuite")
  })

  it("git@ SSH shorthand", async () => {
    const c = await configFromUrl("git@github.com:nrjdalal/picksuite.git", { branch: "main" })
    expect(c).toMatchObject({ host: "github.com", owner: "nrjdalal", repository: "picksuite" })
  })

  it("tree with sub-path → type tree, default target = last segment", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/main/folder/deep", {})
    expect(c).toMatchObject({ type: "tree", branch: "main", path: "folder/deep", target: "deep" })
  })

  it("tree with no sub-path → default target = repository", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/main", {})
    expect(c).toMatchObject({ type: "tree", branch: "main", path: "", target: "picksuite" })
  })

  it("blob → type blob, default target = '.'", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/blob/main/folder/nested.txt", {})
    expect(c).toMatchObject({
      type: "blob",
      branch: "main",
      path: "folder/nested.txt",
      target: ".",
    })
  })

  it("commit URL → type repository at that ref", async () => {
    const c = await configFromUrl("https://github.com/nrjdalal/picksuite/commit/8af536b", {})
    expect(c).toMatchObject({ type: "repository", branch: "8af536b", path: "" })
  })

  it("raw refs/heads → type raw", async () => {
    const c = await configFromUrl(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/refs/heads/main/file.txt",
      {},
    )
    expect(c).toMatchObject({ type: "raw", branch: "main", path: "file.txt" })
  })

  it("raw refs/tags → type raw", async () => {
    const c = await configFromUrl(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/refs/tags/v1.0/file.txt",
      {},
    )
    expect(c).toMatchObject({ type: "raw", branch: "v1.0", path: "file.txt" })
  })

  it("raw refs/remotes → branch keeps the remote prefix", async () => {
    const c = await configFromUrl(
      "https://raw.githubusercontent.com/nrjdalal/picksuite/refs/remotes/origin/main/file.txt",
      {},
    )
    expect(c).toMatchObject({ type: "raw", branch: "origin/main", path: "file.txt" })
  })

  it("explicit -b overrides the URL ref and drops refSegments", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/tree/feat/x", { branch: "dev" })
    expect(c.branch).toBe("dev")
    expect(c.refSegments).toBeUndefined()
  })
})

// =====================================================================
// GitLab
// =====================================================================

describe("configFromUrl — gitlab", () => {
  it("repo", async () => {
    const c = await configFromUrl("https://gitlab.com/pages/plain-html", { branch: "main" })
    expect(c).toMatchObject({ host: "gitlab.com", type: "repository", repository: "plain-html" })
  })

  it("tree via /-/tree/", async () => {
    const c = await configFromUrl("https://gitlab.com/pages/plain-html/-/tree/main/public", {})
    expect(c).toMatchObject({ host: "gitlab.com", type: "tree", branch: "main", path: "public" })
  })

  it("blob via /-/blob/", async () => {
    const c = await configFromUrl("https://gitlab.com/pages/plain-html/-/blob/main/README.md", {})
    expect(c).toMatchObject({ host: "gitlab.com", type: "blob", branch: "main", path: "README.md" })
  })
})

// =====================================================================
// Bitbucket — every /src/ path is a tree (never a blob); this is why the
// raw-blob fast path has no bitbucket case.
// =====================================================================

describe("configFromUrl — bitbucket", () => {
  it("repo", async () => {
    const c = await configFromUrl("https://bitbucket.org/atlassian/python-bitbucket", {
      branch: "master",
    })
    expect(c).toMatchObject({ host: "bitbucket.org", type: "repository" })
  })

  it("a /src/ file is still typed as a tree (not blob)", async () => {
    const c = await configFromUrl("https://bitbucket.org/owner/repo/src/main/path/to/file.txt", {})
    expect(c.host).toBe("bitbucket.org")
    expect(c.type).toBe("tree")
    expect(c.type).not.toBe("blob")
  })

  it("a /src/ folder is typed as a tree", async () => {
    const c = await configFromUrl("https://bitbucket.org/owner/repo/src/main/path/to/dir", {})
    expect(c).toMatchObject({ type: "tree", branch: "main", path: "path/to/dir" })
  })
})

// =====================================================================
// Codeberg (Gitea/Forgejo) — src/* is a tree, raw|media/* is a blob for
// branch, tag and commit refs alike.
// =====================================================================

describe("configFromUrl — codeberg", () => {
  it("repo", async () => {
    const c = await configFromUrl("https://codeberg.org/Codeberg/avatars", { branch: "main" })
    expect(c).toMatchObject({ host: "codeberg.org", type: "repository", repository: "avatars" })
  })

  it("src/branch → tree", async () => {
    const c = await configFromUrl(
      "https://codeberg.org/Codeberg/avatars/src/branch/main/internal",
      {},
    )
    expect(c).toMatchObject({ type: "tree", branch: "main", path: "internal" })
  })

  it("raw/branch → blob", async () => {
    const c = await configFromUrl(
      "https://codeberg.org/Codeberg/avatars/raw/branch/main/README.md",
      {},
    )
    expect(c).toMatchObject({ type: "blob", branch: "main", path: "README.md" })
  })

  it("raw/tag → blob (kind discarded, ref name kept)", async () => {
    const c = await configFromUrl(
      "https://codeberg.org/Codeberg/avatars/raw/tag/v1.0.0/README.md",
      {},
    )
    expect(c).toMatchObject({ type: "blob", branch: "v1.0.0", path: "README.md" })
  })

  it("raw/commit → blob", async () => {
    const c = await configFromUrl(
      "https://codeberg.org/Codeberg/avatars/raw/commit/8da63012/README.md",
      {},
    )
    expect(c).toMatchObject({ type: "blob", branch: "8da63012", path: "README.md" })
  })

  it("media/branch → blob", async () => {
    const c = await configFromUrl(
      "https://codeberg.org/Codeberg/avatars/media/branch/main/logo.png",
      {},
    )
    expect(c).toMatchObject({ type: "blob", branch: "main", path: "logo.png" })
  })
})

// =====================================================================
// Token extraction & target resolution
// =====================================================================

describe("configFromUrl — token in URL", () => {
  it("extracts an inline token and strips it from the host", async () => {
    const c = await configFromUrl("https://ghp_secret@github.com/o/r/blob/main/f.txt", {})
    expect(c.token).toBe("ghp_secret")
    expect(c.host).toBe("github.com")
    expect(c.owner).toBe("o")
  })

  it("token is always a string (empty or the env token, never undefined)", async () => {
    const c = await configFromUrl("o/r/blob/main/f.txt", {})
    expect(typeof c.token).toBe("string")
  })
})

describe("configFromUrl — target resolution", () => {
  it("explicit target wins for every type", async () => {
    const c = await configFromUrl("nrjdalal/picksuite/blob/main/file.txt", {
      target: "out/here.txt",
    })
    expect(c.target).toBe("out/here.txt")
  })

  it("repository default target = repository name", async () => {
    const c = await configFromUrl("nrjdalal/picksuite", { branch: "main" })
    expect(c.target).toBe("picksuite")
  })
})
