import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { copyDir } from "@/utils/copy-dir"
import { log, spinner } from "@clack/prompts"
import spawn from "~/deps/nano-spawn"

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
  const s = spinner()

  try {
    if (process.platform === "win32") {
      await spawn("git", ["config", "--global", "core.longpaths", "true"])
    }

    const repoUrl = `https://${config.token ? config.token + "@" : config.token}github.com/${config.owner}/${config.repository}.git`
    const tempDir = path.join(
      os.tmpdir(),
      `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
    )

    if (!options.watch)
      s.start(
        `Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}`,
      )

    const start = performance.now()

    await spawn("git", [
      "clone",
      repoUrl,
      tempDir,
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      config.branch,
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
      s.stop(
        `Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${(
          (performance.now() - start) /
          1000
        ).toFixed(2)} seconds!`,
      )
    } else log.success("Synced at " + new Date().toLocaleTimeString())

    await fs.promises.rm(tempDir, { recursive: true, force: true })
  } catch (err) {
    s.stop("Level 2: An error occurred while cloning!")

    if (err instanceof Error) {
      log.error("Error: " + err.message)
    } else {
      log.error("Unexpected Error: " + JSON.stringify(err, null, 2))
    }

    process.exit(1)
  }
}
