import fs from "fs"
import os from "os"
import path from "path"
import { getDefaultBranch } from "@/utils/get-default-branch"
import { parseTimeString } from "@/utils/parse-time-string"
import { Command } from "commander"
import inquirer from "inquirer"
import ora, { Ora } from "ora"
import simpleGit from "simple-git"
import { z } from "zod"
import { fromError } from "zod-validation-error"
import packageJson from "../../package.json"

const githubRegex = {
  url: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+?)(?<!\/)$/,
  branch: /^[a-zA-Z0-9.\-_]+$/,
}

const schema = z.object({
  url: z.string().regex(githubRegex.url),
  target: z.string().optional(),
  branch: z.string().regex(githubRegex.branch).optional(),
  overwrite: z.boolean().optional(),
})

export const clone = new Command()
  .name("clone")
  .argument("<url>", "GitHub URL with path to file/folder")
  .argument("[target]", "Directory to clone into (optional)")
  .option("-b, --branch <branch>", "Branch to clone")
  .option("-o, --overwrite", "Skip overwrite prompt")
  .option(
    "-w, --watch [time]",
    `Watch the repository and sync every [time]
(e.g. 1h, 30m, 15s) default: 1m`,
  )
  .action(
    async (
      url: string,
      target: string | undefined,
      options: {
        branch?: string
        overwrite?: boolean
        watch?: string | number
      },
    ) => {
      console.log(`\ngitpick v${packageJson.version}\n`)

      if (options.watch) {
        console.log(
          `👀 Watching every ${
            typeof options.watch === "boolean"
              ? "1m"
              : parseTimeString(options.watch) / 1000 + "s"
          }\n`,
        )
      }

      const spinner = ora().start()

      try {
        url = url
          .replace("git://", "https://")
          .replace("http://", "https://")
          .replace("git@github.com:", "https://github.com/")

        if (!url.startsWith("https://github.com")) {
          url = `https://github.com/${url}`
        }

        if (url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(\.git)?$/)) {
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

        schema.parse({
          url,
          target,
          branch: options.branch,
          overwrite: options.overwrite,
        })

        const match = url.match(githubRegex.url)

        const config = {
          owner: match![1],
          repository: match![2].endsWith(".git")
            ? match![2].slice(0, -4)
            : match![2],
          branch: options.branch || match![4],
          path: match![5],
          target: target
            ? target
            : match![3] === "blob"
              ? "."
              : match![5].split("/").pop()!,
          type: match![3] === "blob" ? "file" : "directory",
        }

        spinner.stop()
        console.log(config, "\n")

        const targetPath = path.resolve(
          config.type === "directory"
            ? config.target
            : config.target + "/" + config.path.split("/").pop()!,
        )

        if (options.watch) options.overwrite = true

        if (
          fs.existsSync(targetPath) &&
          (await fs.promises.readdir(targetPath)).length &&
          !options.overwrite
        ) {
          const message =
            config.type === "directory"
              ? "The target directory is not empty. Do you want to overwrite the files?"
              : "The target file already exists. Do you want to overwrite the file?"

          const { overwrite } = await inquirer.prompt([
            {
              type: "confirm",
              name: "overwrite",
              message,
              default: false,
            },
          ])

          if (!overwrite) {
            throw new Error("Chose not to overwrite files")
          }

          spinner.info("You can use -o | --overwrite flag to skip this prompt")
        }

        await cloneAction(spinner, config, options, targetPath)

        if (options.watch) {
          const watchInterval = parseTimeString(options.watch) || 60000
          setInterval(
            async () => await cloneAction(spinner, config, options, targetPath),
            watchInterval,
          )
        }
      } catch (err) {
        console.log("\n")
        spinner.fail("An error occurred")
        const validationError = fromError(err)
        console.log("\n" + validationError.toString() + "\n")
        process.exit(1)
      }
    },
  )

async function copyDir(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  await fs.promises.mkdir(dest, { recursive: true })

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

const cloneAction = async (
  spinner: Ora,
  config: {
    owner: string
    repository: string
    branch: string
    type: string
    path: string
  },
  options: {
    watch?: string | number
  },
  targetPath: string,
) => {
  try {
    const git = simpleGit()
    const repoUrl = `https://github.com/${config.owner}/${config.repository}.git`
    const tempDir = path.join(os.tmpdir(), `${config.repository}-${Date.now()}`)

    if (!options.watch) spinner.start(`Cloning ${config.type} from repository`)
    await git.clone(repoUrl, tempDir, [
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
      await fs.promises.mkdir(targetPath.split("/").slice(0, -1).join("/"), {
        recursive: true,
      })
      await fs.promises.copyFile(sourcePath, targetPath)
    }
    if (!options.watch) {
      spinner.succeed(
        `${config.type.slice(0, 1).toUpperCase() + config.type.slice(1)} cloned from repository`,
      )
    } else spinner.succeed("Synced at " + new Date().toLocaleTimeString())

    await fs.promises.rm(tempDir, { recursive: true, force: true })
  } catch {
    throw new Error("An error occurred while cloning the repository")
  }
}
