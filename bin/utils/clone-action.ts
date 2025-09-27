import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { copyDir } from "@/utils/copy-dir"
import spawn from "~/external/nano-spawn"
import yoctospinner from "~/external/yocto-spinner"
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

  const repoUrl = `https://${config.token ? config.token + "@" : ""}github.com/${config.owner}/${config.repository}.git`
  const tempDir = path.resolve(
    os.tmpdir(),
    `${config.repository}-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
  )

  const toPosix = (p: string) => p.split(path.sep).join("/")

  const spinner = yoctospinner()
  const start = performance.now()

  if (!options.watch) {
    spinner.start(
      `Picking ${config.type}${config.type === "repository" ? " without .git" : " from repository"}...`,
    )
  }

  const wantsSubpath = !!config.path && config.path !== "." && config.type !== "repository"
  const isFilePath = wantsSubpath && path.extname(config.path) !== ""
  const sparsePath = wantsSubpath
    ? toPosix(isFilePath ? path.dirname(config.path) : config.path)
    : ""

  let usedSparse = false

  try {
    if (wantsSubpath) {
      await fs.promises.mkdir(tempDir, { recursive: true })
      await spawn("git", [
        "clone",
        "--depth=1",
        "--filter=blob:none",
        "--sparse",
        "--single-branch",
        "--no-tags",
        "--branch",
        config.branch,
        repoUrl,
        tempDir,
      ])

      await spawn(
        "git",
        ["sparse-checkout", "init", ...(isFilePath ? ["--no-cone"] : ["--cone"])],
        { cwd: tempDir },
      )
      await spawn("git", ["sparse-checkout", "set", sparsePath], { cwd: tempDir })
      await spawn("git", ["checkout"], { cwd: tempDir })

      if (options.recursive) {
        await spawn("git", ["submodule", "update", "--init", "--recursive"], {
          cwd: tempDir,
        })
      }

      usedSparse = true
    } else {
      await spawn("git", [
        "clone",
        repoUrl,
        tempDir,
        "--branch",
        config.branch,
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
        ...(options.recursive ? ["--recursive"] : []),
      ])
    }
  } catch {
    try {
      await spawn("git", ["clone", repoUrl, tempDir, ...(options.recursive ? ["--recursive"] : [])])
      await spawn("git", ["checkout", config.branch], { cwd: tempDir })
    } catch {
      throw new Error("Failed to clone repository")
    }
  }

  const sourcePath = path.resolve(tempDir, config.path)

  const sourceStat = await fs.promises.stat(sourcePath)

  if (sourceStat.isDirectory()) {
    await fs.promises.mkdir(targetPath, { recursive: true })
    await copyDir(sourcePath, targetPath)
  } else {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.promises.copyFile(sourcePath, targetPath)
  }

  if (!options.watch) {
    spinner.success(
      `Picked ${config.type}${config.type === "repository" ? " without .git" : " from repository"} in ${(
        (performance.now() - start) /
        1000
      ).toFixed(2)} seconds${usedSparse ? green(" (sparse)") : ""}.`,
    )
  } else console.log("- Synced at " + new Date().toLocaleTimeString())

  await fs.promises.rm(tempDir, { recursive: true, force: true })
}
