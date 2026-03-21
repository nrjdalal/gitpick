import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import spawn from "@/external/nano-spawn"
import { spinner } from "@/external/yocto-spinner"
import { copyDir } from "@/utils/copy-dir"

export type CloneResult = {
  files: string[]
  duration: number
}

export const cloneAction = async (
  config: {
    token: string
    host: string
    owner: string
    repository: string
    branch: string
    type: string
    path: string
  },
  options: {
    recursive?: boolean
    watch?: string
    tree?: boolean
  },
  targetPath: string,
): Promise<CloneResult> => {
  const silent = options.tree

  if (process.platform === "win32") {
    await spawn("git", ["config", "--global", "core.longpaths", "true"])
  }

  const repoUrl = `https://${config.token ? config.token + "@" : config.token}${config.host}/${config.owner}/${config.repository}.git`
  const tempDir = path.resolve(
    os.tmpdir(),
    `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  )

  const s = spinner()
  const start = performance.now()

  if (!options.watch && !silent) {
    s.start(
      `Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}...`,
    )
  }

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
    await spawn("git", ["clone", repoUrl, tempDir, ...(options.recursive ? ["--recursive"] : [])])
    await spawn("git", ["checkout", config.branch], { cwd: tempDir })
  }

  const sourcePath = path.resolve(tempDir, config.path)

  const sourceStat = await fs.promises.stat(sourcePath)

  let files: string[] = []

  if (sourceStat.isDirectory()) {
    await fs.promises.mkdir(targetPath, { recursive: true })
    files = await copyDir(sourcePath, targetPath)
  } else {
    await fs.promises.mkdir(path.dirname(targetPath), {
      recursive: true,
    })
    await fs.promises.copyFile(sourcePath, targetPath)
    files = [path.basename(targetPath)]
  }

  const duration = Number(((performance.now() - start) / 1000).toFixed(2))

  if (!silent) {
    if (!options.watch) {
      s.success(
        `Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${duration} seconds.`,
      )
    } else console.log("- Synced at " + new Date().toLocaleTimeString())
  }

  await fs.promises.rm(tempDir, { recursive: true, force: true })

  return { files, duration }
}
