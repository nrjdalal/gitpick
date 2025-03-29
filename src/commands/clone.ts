import fs from "fs"
import os from "os"
import path from "path"
import { parseTimeString } from "@/utils/parse-time-string"
import { githubConfigFromUrl } from "@/utils/transform-url"
import { Command } from "commander"
import inquirer from "inquirer"
import ora, { Ora } from "ora"
import simpleGit from "simple-git"
import { z } from "zod"
import { fromError } from "zod-validation-error"

const schema = z.object({
  url: z.string(),
  target: z.string().optional(),
  branch: z.string().optional(),
  overwrite: z.boolean().optional(),
  watch: z.union([z.string(), z.number(), z.boolean()]).optional(),
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
      options: z.infer<typeof schema>,
    ) => {
      schema.parse({
        url,
        target,
        branch: options.branch,
        overwrite: options.overwrite,
        watch: options.watch,
      })

      if (options.watch) {
        if (typeof options.watch === "boolean") options.watch = "1m"

        console.log(
          `👀 Watching every ${parseTimeString(options.watch) / 1000 + "s"}\n`,
        )
      }

      const config = await githubConfigFromUrl(url, {
        branch: options.branch,
        target,
      })

      const { token, ...configWithoutToken } = config
      console.log(configWithoutToken, "\n")

      const spinner = ora().start()

      try {
        spinner.stop()

        const targetPath = path.resolve(config.target)

        if (options.watch) options.overwrite = true

        if (
          fs.existsSync(
            targetPath +
              (config.type === "blob"
                ? "/" + config.path.split("/").pop()
                : ""),
          ) &&
          (await fs.promises.readdir(targetPath)).length &&
          !options.overwrite
        ) {
          const message =
            config.type === "tree"
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
          const watchInterval = parseTimeString(options.watch)
          setInterval(
            async () => await cloneAction(spinner, config, options, targetPath),
            watchInterval,
          )
        }
      } catch (err) {
        console.log("\n")
        spinner.fail(" Level 1: An error occurred")

        if (err instanceof z.ZodError) {
          const validationError = fromError(err)
          console.error(
            "\nValidation Error:\n" + validationError.toString() + "\n",
          )
        } else if (err instanceof Error) {
          console.error("\nError:\n" + err.message + "\n")
        } else {
          console.error(
            "\nUnexpected Error:\n" + JSON.stringify(err, null, 2) + "\n",
          )
        }

        process.exit(1)
      }
    },
  )

async function copyDir(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  await fs.promises.mkdir(dest, { recursive: true })

  for (let entry of entries) {
    if (entry.name === ".git") continue
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
  try {
    const git = simpleGit()

    if (process.platform === "win32") {
      await git.addConfig("core.longpaths", "true", true)
    }

    const repoUrl = `https://${config.token ? config.token + "@" : config.token}github.com/${config.owner}/${config.repository}.git`
    const tempDir = path.join(
      os.tmpdir(),
      `${config.repository}-${Math.random().toString(16).slice(2, 8)}`,
    )

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
      await fs.promises.mkdir(targetPath, {
        recursive: true,
      })
      await fs.promises.copyFile(
        sourcePath,
        targetPath + "/" + config.path.split("/").pop(),
      )
    }
    if (!options.watch) {
      spinner.succeed(
        `${config.type.slice(0, 1).toUpperCase() + config.type.slice(1)} cloned from repository`,
      )
    } else spinner.succeed("Synced at " + new Date().toLocaleTimeString())

    await fs.promises.rm(tempDir, { recursive: true, force: true })
  } catch (err) {
    console.log("\n")
    spinner.fail(" Level 2: An error occurred!")

    if (err instanceof Error) {
      console.error("\nError:\n" + err.message + "\n")
    } else {
      console.error(
        "\nUnexpected Error:\n" + JSON.stringify(err, null, 2) + "\n",
      )
    }

    process.exit(1)
  }
}
