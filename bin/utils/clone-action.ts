import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import spawn from "@/external/nano-spawn"
import { spinner } from "@/external/yocto-spinner"
import { cyan, dim } from "@/external/yoctocolors"
import { activeTempPaths } from "@/utils/cleanup"
import { copyDir } from "@/utils/copy-dir"
import { elapsedSeconds } from "@/utils/elapsed"
import { fetchRawBlob } from "@/utils/raw-blob"
import { cloneShallowOrFull, reanchorIfPathMissing } from "@/utils/resolve-ref"
import { tempName } from "@/utils/temp-name"

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
    refSegments?: string[]
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

  const displayUrl = `https://${config.host}/${config.owner}/${config.repository}.git`

  const s = spinner()
  const start = performance.now()

  if (!options.watch && !silent) {
    s.start(
      `Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}...`,
    )
  }

  // Shared success reporting for both the fast (raw GET) and clone paths.
  const report = (
    files: string[],
    totalSize: number,
    networkTime: number,
    copyTime: number,
    cloneStrategy: string,
  ): CloneResult => {
    const duration = elapsedSeconds(start)

    if (!silent) {
      if (!options.watch) {
        s.success(
          `Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${duration} seconds.`,
        )
      } else console.log("- Synced at " + new Date().toLocaleTimeString())
    }

    if (verbose) {
      console.log(
        dim(
          `  clone:    ${cloneStrategy}${cloneStrategy === "raw" ? " (single GET)" : ` (depth=${cloneStrategy === "shallow" ? "1" : "full"})`}`,
        ),
      )
      console.log(dim(`  from:     ${displayUrl} @ ${cyan(config.branch)}`))
      console.log(dim(`  to:       ${targetPath}`))
      console.log(dim(`  files:    ${files.length} (${formatSize(totalSize)})`))
      console.log(dim(`  network:  ${networkTime}s`))
      console.log(dim(`  copy:     ${copyTime}s`))
      console.log(dim(`  total:    ${duration}s`))
    }

    return { files, duration, networkTime, copyTime, totalSize, cloneStrategy }
  }

  // Fast path: a single-file (blob/raw) pick needs one raw-endpoint GET, not a
  // whole-tree shallow clone. Any miss (unsupported host, a private repo the raw
  // host won't serve, a slash-branch the optimistic ref guessed wrong, a 4xx/5xx)
  // returns null and falls through to the clone path, so correctness is unchanged.
  if (config.type === "blob" || config.type === "raw") {
    const raw = await fetchRawBlob(config, targetPath)
    if (raw) {
      return report([path.basename(targetPath)], raw.size, raw.networkTime, raw.copyTime, "raw")
    }
  }

  const repoUrl = `https://${config.token ? config.token + "@" : config.token}${config.host}/${config.owner}/${config.repository}.git`
  const tempDir = path.resolve(os.tmpdir(), tempName(`${config.repository}-`))
  activeTempPaths.add(tempDir)

  const networkStart = performance.now()

  let cloneStrategy = await cloneShallowOrFull(repoUrl, tempDir, config, options.recursive)
  // A tag can shadow a longer branch on the successful path; re-anchor if the
  // optimistically-guessed sub-path is absent (no-op when it exists).
  const reStrategy = await reanchorIfPathMissing(
    repoUrl,
    tempDir,
    config,
    options.recursive,
    cloneStrategy,
  )
  if (reStrategy) cloneStrategy = reStrategy

  const networkTime = elapsedSeconds(networkStart)

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

  const copyTime = elapsedSeconds(copyStart)

  let totalSize = 0
  for (const file of files) {
    try {
      const stat = await fs.promises.stat(path.join(targetPath, file))
      totalSize += stat.size
    } catch {
      // single file (blob): targetPath is the file itself
      const stat = await fs.promises.stat(targetPath)
      totalSize += stat.size
      break
    }
  }

  await fs.promises.rm(tempDir, { recursive: true, force: true })
  activeTempPaths.delete(tempDir)

  return report(files, totalSize, networkTime, copyTime, cloneStrategy)
}
