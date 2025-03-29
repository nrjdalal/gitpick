import fs from "fs"
import os from "os"
import path from "path"
import { parseTimeString } from "@/utils/parse-time-string"
import { githubConfigFromUrl } from "@/utils/transform-url"
import { cancel, confirm, intro, isCancel, log, spinner } from "@clack/prompts"
import { Command } from "commander"
import simpleGit from "simple-git"
import colors from "yoctocolors"
import { z } from "zod"
import { fromError } from "zod-validation-error"

const schema = z.object({
  url: z.string(),
  target: z.string().optional(),
  branch: z.string().optional(),
  overwrite: z.boolean().optional(),
  force: z.boolean().optional(),
  watch: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

export const clone = new Command()
  .name("clone")
  .argument("<url>", "GitHub URL with path to file/folder")
  .argument("[target]", "Directory to clone into (optional)")
  .option("-b, --branch <branch>", "Branch to clone")
  .option("-o, --overwrite", "Skip overwrite prompt")
  .option("-f, --force", "Alias for --overwrite")
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
        force: options.force,
        watch: options.watch,
      })

      options.overwrite = options.overwrite || options.force

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

      intro(
        `${colors.bold(config.owner)}/${colors.bold(config.repository)} ${colors.green(
          `<${config.type}:${config.branch}>`,
        )} ${
          config.type === "repository"
            ? `> ${colors.cyan(config.target)}`
            : `${colors.yellow(config.path)} > ${colors.cyan(
                `${config.target}${
                  config.type === "blob"
                    ? `/${config.path.split("/").pop()}`
                    : ""
                }`,
              )}`
        }`,
      )

      try {
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

          const overwrite = await confirm({
            message,
          })

          if (isCancel(overwrite)) {
            cancel("Operation cancelled.")
            process.exit(0)
          }

          if (!overwrite) {
            log.info("Chose not to overwrite files.")
            process.exit(0)
          }

          log.info(
            "You can use -o | --overwrite or -f | --force flag to skip this prompt next time.",
          )
        }

        await cloneAction(config, options, targetPath)

        if (options.watch) {
          const watchInterval = parseTimeString(options.watch)
          setInterval(
            async () => await cloneAction(config, options, targetPath),
            watchInterval,
          )
        }
      } catch (err) {
        log.error("Level 1: An error occurred")

        if (err instanceof z.ZodError) {
          const validationError = fromError(err)
          log.error("Validation Error: " + validationError.toString())
        } else if (err instanceof Error) {
          log.error("Error: " + err.message)
        } else {
          log.error("Unexpected Error: " + JSON.stringify(err, null, 2))
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
    const git = simpleGit()

    if (process.platform === "win32") {
      await git.raw(["config", "--global", "core.longpaths", "true"])
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
