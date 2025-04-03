import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { copyDir } from "@/utils/copy-dir"
import spawn from "~/external/nano-spawn"
import { green } from "~/external/yoctocolors"

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
    recursive?: boolean
    watch?: string
  },
  targetPath: string,
) => {
  if (process.platform === "win32") {
    await spawn("git", ["config", "--global", "core.longpaths", "true"])
  }

  const repoUrl = `https://${config.token ? config.token + "@" : config.token}github.com/${config.owner}/${config.repository}.git`
  const tempDir = path.resolve(
    os.tmpdir(),
    `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  )

  if (!options.watch)
    console.log(
      `${green("✔")} Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}...`,
    )

  const start = performance.now()

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
      ...(options.recursive ? ["--recursive"] : []),
    ])
  } catch {
    console.log(`${green("✔")} Using robust checkout process...`)
    await spawn("git", [
      "clone",
      repoUrl,
      tempDir,
      ...(options.recursive ? ["--recursive"] : []),
    ])
    await spawn("git", ["checkout", config.branch], { cwd: tempDir })
  }

  const sourcePath = path.resolve(tempDir, config.path)

  const sourceStat = await fs.promises.stat(sourcePath)

  if (sourceStat.isDirectory()) {
    await fs.promises.mkdir(targetPath, { recursive: true })
    await copyDir(sourcePath, targetPath)
  } else {
    await fs.promises.mkdir(targetPath.split("/").slice(0, -1).join("/"), {
      recursive: true,
    })
    await fs.promises.copyFile(sourcePath, targetPath)
  }

  if (!options.watch) {
    console.log(
      `${green("✔")} Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${(
        (performance.now() - start) /
        1000
      ).toFixed(2)} seconds.`,
    )
  } else console.log("- Synced at " + new Date().toLocaleTimeString())

  await fs.promises.rm(tempDir, { recursive: true, force: true })
}
