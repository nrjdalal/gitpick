import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { copyDir } from "@/utils/copy-dir"
import spawn from "~/external/nano-spawn"

export const cloneAction = async (
  config: {
    token: string
    owner: string
    repository: string
    branch: string
    type: string
    path: string
  },
  options: {
    watch?: string | number | boolean
  },
  targetPath: string,
) => {
  if (process.platform === "win32") {
    await spawn("git", ["config", "--global", "core.longpaths", "true"])
  }

  const repoUrl = `https://${config.token ? config.token + "@" : config.token}github.com/${config.owner}/${config.repository}.git`
  const tempDir = path.join(
    os.tmpdir(),
    `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  )

  if (!options.watch)
    console.log(
      `🔍 Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"} ...`,
    )

  const start = performance.now()

  await spawn("git", [
    "clone",
    repoUrl,
    tempDir,
    "--branch",
    config.branch,
    "--depth",
    "1",
    "--single-branch",
  ])

  const sourcePath = path.join(tempDir, config.path)

  const sourceStat = await fs.promises.stat(sourcePath)

  if (sourceStat.isDirectory()) {
    await fs.promises.mkdir(targetPath, { recursive: true })
    await copyDir(sourcePath, targetPath)
  } else {
    await fs.promises.mkdir(targetPath, {
      recursive: true,
    })
    await fs.promises.copyFile(
      sourcePath,
      targetPath + "/" + config.path.split("/").pop(),
    )
  }

  if (!options.watch) {
    console.log(
      `\n🎉 Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${(
        (performance.now() - start) /
        1000
      ).toFixed(2)} seconds!`,
    )
  } else console.info("- Synced at " + new Date().toLocaleTimeString())

  await fs.promises.rm(tempDir, { recursive: true, force: true })
}
