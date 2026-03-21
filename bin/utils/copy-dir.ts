import fs from "node:fs"
import path from "node:path"

export const copyDir = async (
  src: string,
  dest: string,
  relativeTo?: string,
): Promise<string[]> => {
  const base = relativeTo ?? dest
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  await fs.promises.mkdir(dest, { recursive: true })

  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === ".git") continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await copyDir(srcPath, destPath, base)))
    } else if (entry.isSymbolicLink()) {
      const link = await fs.promises.readlink(srcPath)
      await fs.promises.symlink(link, destPath)
      files.push(path.relative(base, destPath))
    } else {
      await fs.promises.copyFile(srcPath, destPath)
      files.push(path.relative(base, destPath))
    }
  }

  return files
}
