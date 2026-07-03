import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import spawn from "@/external/nano-spawn"
import { yellow } from "@/external/yoctocolors"
import { tempName } from "@/utils/temp-name"

// git's own explanation for a failure (missing identity, nothing to commit, an
// ignored path, …), preferring stderr, then stdout, then the thrown message.
const gitReason = (err: any) =>
  err?.stderr?.trim() || err?.stdout?.trim() || err?.message || "git failed"

// Optionally turn the freshly-cloned output into a git repo, and (with
// `--commit <msg>` or `--auto-commit`) create an initial commit. Committing
// implies `--init`. Any git failure is surfaced but never undoes the
// already-successful clone.
export const initGitRepo = async (
  targetPath: string,
  options: {
    init?: boolean
    commit?: string
    autoCommit?: boolean
    quiet?: boolean
    tree?: boolean
  },
  stagePaths?: string[],
) => {
  const wantCommit = Boolean(options.autoCommit) || options.commit !== undefined
  if (!options.init && !wantCommit) return

  // Skip warnings are important signals, so they gate on --quiet only (not
  // --tree, which is just an output-format choice).
  const silent = options.quiet
  const isFile = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()
  const repoPath = isFile ? path.dirname(targetPath) : targetPath

  // Refuse to initialize the user's current working directory — for a lone file
  // it's never wanted, and for a directory clone into `.` a commit would sweep
  // unrelated files that already live there.
  if (path.resolve(repoPath) === process.cwd()) {
    if (!silent) {
      console.log(
        yellow(
          `\nSkipping git init: won't initialize a repository in the current directory (clone into a sub-directory to init there).`,
        ),
      )
    }
    return
  }

  if (!fs.existsSync(path.join(repoPath, ".git"))) {
    try {
      await spawn("git", ["init"], { cwd: repoPath })
    } catch (err: any) {
      // Never let an init failure undo the successful clone.
      if (!silent) console.log(yellow(`\nSkipping git init — git reported:\n${gitReason(err)}`))
      return
    }
  }

  if (!wantCommit) return

  // Nothing was cloned (empty tree, everything ignored, or an empty pick): never
  // fall back to `git add .`, which would sweep a pre-existing target's own
  // files into the commit.
  if (!isFile && !stagePaths?.length) {
    if (!silent) console.log(yellow(`\nSkipping commit: nothing was cloned to commit.`))
    return
  }

  // Empty string (explicit `--commit ""`) falls back to the default too.
  const message = options.commit || "chore: gitpick'ed"
  try {
    // Stage exactly what was cloned — the blob's own file or the picked
    // paths/cloned tree — so unrelated contents of a pre-existing target
    // directory are never swept into the commit. `--force` so a `.gitignore`
    // that rode along in the clone can't abort staging of files the user
    // explicitly asked to pick.
    if (isFile) {
      await spawn("git", ["add", "--force", "--", path.basename(targetPath)], { cwd: repoPath })
    } else {
      // Normalize Windows "\" separators to "/" so paths match git's index.
      const specs = (stagePaths ?? []).map((p) => p.split(path.sep).join("/"))
      // Feed the cloned paths through a NUL-delimited pathspec file so a huge
      // picked tree can't overflow the argv limit (E2BIG). `--pathspec-file-nul`
      // takes entries literally. `--pathspec-from-file` needs git >= 2.25, so
      // fall back to passing paths as argv on older git (fine at typical sizes).
      const listFile = path.join(os.tmpdir(), tempName("gitpick-add-"))
      await fs.promises.writeFile(listFile, specs.join("\0"))
      try {
        await spawn(
          "git",
          ["add", "--force", `--pathspec-from-file=${listFile}`, "--pathspec-file-nul"],
          { cwd: repoPath },
        )
      } catch {
        await spawn("git", ["add", "--force", "--", ...specs], { cwd: repoPath })
      } finally {
        await fs.promises.rm(listFile, { force: true })
      }
    }
    await spawn("git", ["commit", "-m", message], { cwd: repoPath })
  } catch (err: any) {
    if (!silent) console.log(yellow(`\nSkipping commit — git reported:\n${gitReason(err)}`))
  }
}
