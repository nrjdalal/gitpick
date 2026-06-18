import fs from "node:fs"
import path from "node:path"

import { type IgnoreMatcher, loadIgnore } from "@/utils/gitpick-ignore"

type CopyContext = {
  matcher: IgnoreMatcher | null
  srcRoot: string
}

export const copyDir = async (
  src: string,
  dest: string,
  relativeTo?: string,
  ctx?: CopyContext,
): Promise<string[]> => {
  const base = relativeTo ?? dest
  // On the top-level call, load `<src>/.gitpickignore` once and thread it down.
  const context: CopyContext = ctx ?? { matcher: loadIgnore(src), srcRoot: src }
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
      await fs.promises.symlink(link, destPath)
      files.push(path.relative(base, destPath))
    } else {
      await fs.promises.copyFile(srcPath, destPath)
      files.push(path.relative(base, destPath))
    }
  }

  return files
}
