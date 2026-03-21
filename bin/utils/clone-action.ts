import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import spawn from "@/external/nano-spawn"
import { spinner } from "@/external/yocto-spinner"
import { cyan, dim } from "@/external/yoctocolors"
import { copyDir } from "@/utils/copy-dir"

const activeTempDirs = new Set<string>()

function cleanupAndExit() {
  for (const dir of activeTempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
  process.exit(1)
}

process.on("SIGINT", cleanupAndExit)
process.on("SIGTERM", cleanupAndExit)

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type CloneResult = {
  files: string[]
  duration: number
  networkTime: number
  copyTime: number
  totalSize: number
  cloneStrategy: string
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
    quiet?: boolean
    tree?: boolean
    verbose?: boolean
  },
  targetPath: string,
): Promise<CloneResult> => {
  const silent = options.tree || options.quiet
  const verbose = options.verbose && !silent

  if (process.platform === "win32") {
    await spawn("git", ["config", "--global", "core.longpaths", "true"])
  }

  const repoUrl = `https://${config.token ? config.token + "@" : config.token}${config.host}/${config.owner}/${config.repository}.git`
  const displayUrl = `https://${config.host}/${config.owner}/${config.repository}.git`
  const tempDir = path.resolve(
    os.tmpdir(),
    `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  )

  activeTempDirs.add(tempDir)

  const s = spinner()
  const start = performance.now()

  if (!options.watch && !silent) {
    s.start(
      `Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}...`,
    )
  }

  let cloneStrategy = "shallow"
  const networkStart = performance.now()

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
    cloneStrategy = "full"
    await spawn("git", ["clone", repoUrl, tempDir, ...(options.recursive ? ["--recursive"] : [])])
    await spawn("git", ["checkout", config.branch], { cwd: tempDir })
  }

  const networkTime = Number(((performance.now() - networkStart) / 1000).toFixed(2))

  const sourcePath = path.resolve(tempDir, config.path)

  const sourceStat = await fs.promises.stat(sourcePath)

  let files: string[] = []
  const copyStart = performance.now()

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

  const copyTime = Number(((performance.now() - copyStart) / 1000).toFixed(2))
  const duration = Number(((performance.now() - start) / 1000).toFixed(2))

  let totalSize = 0
  for (const file of files) {
    try {
      const stat = await fs.promises.stat(path.join(targetPath, file))
      totalSize += stat.size
    } catch {
      // single file (blob) — targetPath is the file itself
      const stat = await fs.promises.stat(targetPath)
      totalSize += stat.size
      break
    }
  }

  if (!silent) {
    if (!options.watch) {
      s.success(
        `Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${duration} seconds.`,
      )
    } else console.log("- Synced at " + new Date().toLocaleTimeString())
  }

  if (verbose) {
    console.log(
      dim(`  clone:    ${cloneStrategy} (depth=${cloneStrategy === "shallow" ? "1" : "full"})`),
    )
    console.log(dim(`  from:     ${displayUrl} @ ${cyan(config.branch)}`))
    console.log(dim(`  to:       ${targetPath}`))
    console.log(dim(`  files:    ${files.length} (${formatSize(totalSize)})`))
    console.log(dim(`  network:  ${networkTime}s`))
    console.log(dim(`  copy:     ${copyTime}s`))
    console.log(dim(`  total:    ${duration}s`))
  }

  await fs.promises.rm(tempDir, { recursive: true, force: true })
  activeTempDirs.delete(tempDir)

  return { files, duration, networkTime, copyTime, totalSize, cloneStrategy }
}
