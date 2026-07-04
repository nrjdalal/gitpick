import fs from "node:fs"
import path from "node:path"

import { type IgnoreMatcher, loadIgnore } from "@/utils/gitpick-ignore"

export type CopyContext = {
  matcher: IgnoreMatcher | null
  srcRoot: string
}

// Anchor a `.gitpickignore` matcher at `root` so paths are excluded relative
// to it. Callers that copy several picks under one root build this once and
// thread it into each copyDir call (and their own top-level file handling) so
// a single root-level ignore file governs every copy the same way.
export const createCopyContext = (root: string): CopyContext => ({
  matcher: loadIgnore(root),
  srcRoot: root,
})

export const copyDir = async (
  src: string,
  dest: string,
  relativeTo?: string,
  ctx?: CopyContext,
): Promise<string[]> => {
  const base = relativeTo ?? dest
  // On the top-level call, load `<src>/.gitpickignore` once and thread it down.
  const context: CopyContext = ctx ?? createCopyContext(src)
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  await fs.promises.mkdir(dest, { recursive: true })

  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === ".git") continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    const rel = path.relative(context.srcRoot, srcPath)
    if (rel === ".gitpickignore") continue
    if (context.matcher?.ignores(rel, entry.isDirectory())) continue

    if (entry.isDirectory()) {
      files.push(...(await copyDir(srcPath, destPath, base, context)))
    } else if (entry.isSymbolicLink()) {
      const link = await fs.promises.readlink(srcPath)
      // remove any existing entry first so symlinks overwrite like copyFile does; symlink() throws EEXIST otherwise
      await fs.promises.rm(destPath, { force: true, recursive: true })
      try {
        await fs.promises.symlink(link, destPath)
        files.push(path.relative(base, destPath))
      } catch {
        // A symlink-hostile filesystem (e.g. a WSL /mnt DrvFs mount) can reject
        // symlink(); warn and skip rather than aborting the whole pick.
        console.warn(
          `Warning: could not create symlink ${path.relative(base, destPath)} -> ${link}`,
        )
      }
    } else {
      await fs.promises.copyFile(srcPath, destPath)
      files.push(path.relative(base, destPath))
    }
  }

  return files
}
