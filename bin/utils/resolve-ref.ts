import fs from "node:fs"
import path from "node:path"

import spawn from "@/external/nano-spawn"

type RefConfig = { branch: string; path: string; refSegments?: string[] }

// A GitHub-style `tree`/`blob` URL can't tell where a slash-containing branch
// ends and the sub-path begins — `tree/feat/marketing/src` could be branch
// `feat` + path `marketing/src` or branch `feat/marketing` + path `src`. Given
// the raw `<ref>/<path>` segments and the known ref names, pick the longest
// leading run that names a real branch or tag; the remainder is the path.
// Returns null when no ref matches (e.g. the segments encode a commit SHA), so
// the caller keeps its optimistic guess.
const pickLongestRef = (
  refs: Set<string>,
  segments: string[],
): { branch: string; path: string } | null => {
  for (let i = segments.length; i >= 1; i--) {
    const candidate = segments.slice(0, i).join("/")
    if (refs.has(candidate)) {
      return { branch: candidate, path: segments.slice(i).join("/") }
    }
  }
  return null
}

// Collect every branch and tag name known to a freshly cloned repo. A plain
// clone keeps branches under refs/remotes/origin/*; refs/heads/* holds only the
// checked-out default branch. We read all three so the same helper works
// against a clone and against a plain local repo (used by the tests).
const localRefs = async (repoDir: string): Promise<Set<string>> => {
  const { stdout } = await spawn(
    "git",
    ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes/origin", "refs/tags"],
    { cwd: repoDir },
  )

  const refs = new Set<string>()
  for (const line of stdout.split("\n")) {
    const ref = line.trim()
    if (ref.startsWith("refs/heads/")) {
      refs.add(ref.slice("refs/heads/".length))
    } else if (ref.startsWith("refs/remotes/origin/")) {
      const name = ref.slice("refs/remotes/origin/".length)
      if (name !== "HEAD") refs.add(name)
    } else if (ref.startsWith("refs/tags/")) {
      refs.add(ref.slice("refs/tags/".length))
    }
  }
  return refs
}

// Same as localRefs but over the network, without cloning: `git ls-remote`
// lists every branch/tag on the remote. Annotated tags also emit a `^{}`
// peeled line — strip that suffix so the tag name matches.
const remoteRefs = async (repoUrl: string): Promise<Set<string>> => {
  const { stdout } = await spawn("git", ["ls-remote", "--heads", "--tags", repoUrl])

  const refs = new Set<string>()
  for (const line of stdout.split("\n")) {
    const ref = line.split("\t")[1]?.trim()
    if (!ref) continue
    if (ref.startsWith("refs/heads/")) {
      refs.add(ref.slice("refs/heads/".length))
    } else if (ref.startsWith("refs/tags/")) {
      refs.add(ref.slice("refs/tags/".length).replace(/\^\{\}$/, ""))
    }
  }
  return refs
}

export const resolveRefFromClone = async (
  repoDir: string,
  segments: string[],
): Promise<{ branch: string; path: string } | null> => {
  if (!segments.length) return null
  return pickLongestRef(await localRefs(repoDir), segments)
}

export const resolveRefFromRemote = async (
  repoUrl: string,
  segments: string[],
): Promise<{ branch: string; path: string } | null> => {
  if (!segments.length) return null
  return pickLongestRef(await remoteRefs(repoUrl), segments)
}

// True when HEAD is not on a branch — i.e. `--branch`/`checkout` landed on a tag
// or a commit rather than a branch.
const isDetachedHead = async (repoDir: string): Promise<boolean> => {
  try {
    await spawn("git", ["symbolic-ref", "-q", "HEAD"], { cwd: repoDir })
    return false
  } catch {
    return true
  }
}

// Resolve `config.branch`/`config.path` against a repo's full ref list, then
// check it out. Used in the full-clone fallback: it rewrites the branch/path to
// the longest ref the URL's segments actually match. With nothing to
// disambiguate it degrades to a plain `git checkout <branch>`, preserving
// SHA/single-segment behavior.
export const resolveAndCheckout = async (repoDir: string, config: RefConfig): Promise<void> => {
  if (config.refSegments?.length) {
    const resolved = await resolveRefFromClone(repoDir, config.refSegments)
    if (resolved) {
      config.branch = resolved.branch
      config.path = resolved.path
    }
  }
  await spawn("git", ["checkout", config.branch], { cwd: repoDir })
}

// Clone `config.branch` cheaply (shallow, single-branch). If that fails — the
// usual cause is a slash branch that got split into branch + path, so the guess
// isn't a real ref — fall back to a full clone and re-anchor against the real
// refs. Returns which strategy actually ran so callers can report it.
export const cloneShallowOrFull = async (
  repoUrl: string,
  tempDir: string,
  config: RefConfig,
  recursive?: boolean,
): Promise<"shallow" | "full"> => {
  const recurse = recursive ? ["--recursive"] : []
  try {
    await spawn("git", [
      "clone",
      repoUrl,
      tempDir,
      "--branch",
      config.branch,
      "--depth",
      "1",
      "--single-branch",
      ...recurse,
    ])
    return "shallow"
  } catch {
    await spawn("git", ["clone", repoUrl, tempDir, ...recurse])
    await resolveAndCheckout(tempDir, config)
    return "full"
  }
}

// The optimistic `--branch` guess also matches tags, so a tag can shadow a
// longer branch (e.g. tag `release` vs branch `release/1.0`): the shallow clone
// *succeeds* on the tag and the sub-path is never re-anchored. Detect that and
// re-resolve against the full ref list via a cheap `ls-remote` (no full clone),
// re-cloning the correct ref. Returns the re-clone strategy, or null when no
// re-anchor happened. Deliberately conservative to avoid mis-firing:
//   - skips after a full clone (it already saw every ref and resolved longest),
//   - skips when the sub-path is present (never touches the network — the common
//     case),
//   - skips when HEAD is on a real branch: `--branch <seg>` matched an actual
//     branch, so the user asked for a sub-path of it and a missing sub-path is a
//     genuine not-found, not a slash-branch to re-anchor. Only a tag match
//     (detached HEAD) can hide a longer intended ref.
export const reanchorIfPathMissing = async (
  repoUrl: string,
  tempDir: string,
  config: RefConfig,
  recursive: boolean | undefined,
  strategy: "shallow" | "full",
): Promise<"shallow" | "full" | null> => {
  if (strategy === "full") return null
  if (!config.refSegments || config.refSegments.length <= 1) return null
  if (fs.existsSync(path.join(tempDir, config.path))) return null
  if (!(await isDetachedHead(tempDir))) return null

  const resolved = await resolveRefFromRemote(repoUrl, config.refSegments)
  if (!resolved || resolved.branch === config.branch) return null

  config.branch = resolved.branch
  config.path = resolved.path

  await fs.promises.rm(tempDir, { recursive: true, force: true })
  return cloneShallowOrFull(repoUrl, tempDir, config, recursive)
}
