import spawn from "@/external/nano-spawn"

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

// A GitHub-style `tree`/`blob` URL can't tell where a slash-containing branch
// ends and the sub-path begins — `tree/feat/marketing/src` could be branch
// `feat` + path `marketing/src` or branch `feat/marketing` + path `src`. Given
// the raw `<ref>/<path>` segments and a cloned repo, pick the longest leading
// run that names a real branch or tag; the remainder is the path. Returns null
// when no ref matches (e.g. the segments encode a commit SHA), so the caller
// keeps its optimistic guess.
export const resolveRefFromClone = async (
  repoDir: string,
  segments: string[],
): Promise<{ branch: string; path: string } | null> => {
  if (!segments.length) return null
  const refs = await localRefs(repoDir)
  for (let i = segments.length; i >= 1; i--) {
    const candidate = segments.slice(0, i).join("/")
    if (refs.has(candidate)) {
      return { branch: candidate, path: segments.slice(i).join("/") }
    }
  }
  return null
}

// Run in the full-clone fallback (after `git clone` without `--single-branch`):
// rewrite `config.branch`/`config.path` to the longest ref the URL's segments
// actually match, then check it out. When there is nothing to disambiguate it
// degrades to a plain `git checkout <branch>`, preserving SHA/single-segment
// behavior.
export const resolveAndCheckout = async (
  repoDir: string,
  config: { branch: string; path: string; refSegments?: string[] },
): Promise<void> => {
  if (config.refSegments?.length) {
    const resolved = await resolveRefFromClone(repoDir, config.refSegments)
    if (resolved) {
      config.branch = resolved.branch
      config.path = resolved.path
    }
  }
  await spawn("git", ["checkout", config.branch], { cwd: repoDir })
}
