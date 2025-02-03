import fs from "fs"
import path from "path"
import { getDefaultBranch } from "@/utils/get-default-branch"
import ora from "ora"
import simpleGit from "simple-git"

export const gitClone = async (url: string, target?: string) => {
  const spinner = ora().start()

  spinner.start("Fetching default branch")
  const defaultBranch = await getDefaultBranch(url)
  spinner.succeed("Default branch fetched")

  spinner.start("Cloning the default branch")
  const git = simpleGit()
  await git.clone(url, target || ".", [
    "--depth",
    "1",
    "--single-branch",
    "--branch",
    defaultBranch,
  ])
  await fs.promises.rm(path.join(target || ".", ".git"), {
    recursive: true,
    force: true,
  })
  spinner.succeed("Repository branch cloned")

  process.exit(0)
}
