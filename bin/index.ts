#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"

import { bold, cyan, green, red, yellow } from "@/external/yoctocolors"
import { cloneAction } from "@/utils/clone-action"
import { parseTimeString } from "@/utils/parse-time-string"
import { configFromUrl } from "@/utils/transform-url"
import { useConfig } from "@/utils/use-config"
import { name, version } from "~/package.json"

const terminalLink = (text: string, url: string) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`

const helpMessage = `
With ${bold(`${terminalLink("GitPick", "https://github.com/nrjdalal/gitpick")}`)} clone specific directories or files from GitHub, GitLab and Bitbucket!

  $ gitpick ${yellow("<url>")} ${green("[target]")} ${cyan("[options]")}

${bold("Hint:")}
  [target] and [options] are optional and if not specified,
  GitPick fallbacks to the default behavior of \`git clone\`

${bold("Arguments:")}
  ${yellow("url")}                GitHub/GitLab/Bitbucket URL with path to file/folder/repository
  ${green("target")}             Directory to clone into (optional)

${bold("Options:")}
  ${cyan("-b, --branch ")}      Branch/SHA to clone
  ${cyan("-n, --dry-run")}      Show what would be cloned without cloning
  ${cyan("-o, --overwrite")}    Skip overwrite prompt
  ${cyan("-r, --recursive")}    Clone submodules
  ${cyan("-w, --watch [time]")} Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s)
  ${cyan("    --tree")}         List copied files as a tree
  ${cyan("-h, --help")}         display help for command
  ${cyan("-v, --version")}      display the version number

${bold("Examples:")}
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch/SHA]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch/SHA] -w [time]
  $ gitpick <url> --dry-run
  $ gitpick https://gitlab.com/owner/repo
  $ gitpick https://bitbucket.org/owner/repo
  
🚀 More awesome tools at ${cyan("https://github.com/nrjdalal")}`

const displayPath = (targetPath: string) => {
  const cwd = process.cwd()
  const home = os.homedir()
  const sep = path.sep
  if (targetPath === cwd) return "."
  if (targetPath.startsWith(cwd + sep))
    return "./" + path.relative(cwd, targetPath).replaceAll(sep, "/")
  if (targetPath.startsWith(home + sep))
    return "~/" + path.relative(home, targetPath).replaceAll(sep, "/")
  return targetPath
}

const printTree = async (dir: string, prefix = "") => {
  const entries = (await fs.promises.readdir(dir, { withFileTypes: true }))
    .filter((e) => e.name !== ".git")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const last = i === entries.length - 1
    const connector = last ? "└── " : "├── "
    const entryPath = path.join(dir, entry.name)

    if (entry.isSymbolicLink()) {
      const target = await fs.promises.readlink(entryPath)
      process.stdout.write(`${prefix}${connector}${cyan(entry.name)} -> ${yellow(target)}\n`)
    } else if (entry.isDirectory()) {
      process.stdout.write(`${prefix}${connector}${bold(cyan(entry.name))}\n`)
      await printTree(entryPath, `${prefix}${last ? "    " : "│   "}`)
    } else {
      process.stdout.write(`${prefix}${connector}${green(entry.name)}\n`)
    }
  }
}

const parse: typeof parseArgs = (config) => {
  try {
    return parseArgs(config)
  } catch (err: any) {
    throw new Error(`Error parsing arguments: ${err.message}`)
  }
}

const main = async () => {
  try {
    const { positionals, values } = parse({
      allowPositionals: true,
      options: {
        branch: { type: "string", short: "b" },
        "dry-run": { type: "boolean", short: "n" },
        force: { type: "boolean", short: "f" },
        help: { type: "boolean", short: "h" },
        tree: { type: "boolean" },
        overwrite: { type: "boolean", short: "o" },
        recursive: { type: "boolean", short: "r" },
        version: { type: "boolean", short: "v" },
        watch: { type: "string", short: "w" },
      },
    })

    if (!positionals.length) {
      if (values.version) {
        console.log(`\n${name}@${version}`)
        process.exit(0)
      }

      if (await useConfig()) process.exit(0)

      console.log(helpMessage)
      process.exit(0)
    }

    if (positionals[0] === "clone") {
      positionals.shift()
    }

    let [url, target] = positionals

    const options = {
      branch: values.branch,
      dryRun: values["dry-run"],
      force: values.force,
      tree: values.tree,
      overwrite: values.overwrite,
      recursive: values.recursive,
      watch: values.watch,
    }

    const silent = options.tree

    if (!silent) {
      console.log(
        `\nWith ${bold(`${terminalLink("GitPick", "https://github.com/nrjdalal/gitpick")}`)} clone specific files, folders, branches, commits and more from GitHub, GitLab and Bitbucket!`,
      )
    }

    const config = await configFromUrl(url, {
      branch: options.branch,
      target,
    })

    if (config.type === "blob") {
      const parts = config.target.split(/[/\\]/).filter((part) => part !== "")
      let lastPart = parts[parts.length - 1]
      if (lastPart !== "." && lastPart !== ".." && lastPart.includes(".")) {
        parts.pop()
      } else {
        lastPart = config.path.split("/").pop() || lastPart
      }
      config.target = [...parts, lastPart].join("/")
    }

    if (!silent) {
      console.info(
        `\n${green("✔")} ${config.owner}/${config.repository} ${cyan(config.type + ":" + config.branch)} ${
          config.type === "repository"
            ? `> ${green(config.target)}`
            : `${!config.path.length ? ">" : yellow(config.path) + " >"} ${green(config.target)}`
        }`,
      )
    }

    const targetPath = path.resolve(config.target)

    if (options.dryRun) {
      if (options.tree) {
        const tempTarget = path.resolve(
          os.tmpdir(),
          `gitpick-dry-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
        )
        try {
          await cloneAction(config, options, tempTarget)
          if (fs.statSync(tempTarget).isDirectory()) {
            process.stdout.write(`${bold(cyan(displayPath(targetPath)))}\n`)
            await printTree(tempTarget)
          } else {
            process.stdout.write(`${green(displayPath(targetPath))}\n`)
          }
        } finally {
          await fs.promises.rm(tempTarget, { recursive: true, force: true })
        }
      }
      if (!silent) console.log()
      process.exit(0)
    }
    options.overwrite = options.overwrite || options.force
    if (options.watch) options.overwrite = true

    if (fs.existsSync(targetPath) && !options.overwrite) {
      if (config.type === "blob") {
        console.log(
          `${yellow(`\nWarning: The target file exists at ${green(config.target)}. Use ${cyan("-f")} or ${cyan("-o")} to overwrite.`)}`,
        )
        process.exit(1)
      }
      if ((await fs.promises.readdir(targetPath)).length) {
        console.log(
          `${yellow(`\nWarning: The target directory exists at ${green(config.target)} and is not empty. Use ${cyan("-f")} or ${cyan("-o")} to overwrite.`)}`,
        )
        process.exit(1)
      }
    }

    const outputResult = async () => {
      if (options.tree) {
        if (fs.statSync(targetPath).isDirectory()) {
          process.stdout.write(`${bold(cyan(displayPath(targetPath)))}\n`)
          await printTree(targetPath)
        } else {
          process.stdout.write(`${green(displayPath(targetPath))}\n`)
        }
      }
    }

    if (options.watch) {
      if (!silent)
        console.log(`\n👀 Watching every ${parseTimeString(options.watch) / 1000 + "s"}\n`)
      await cloneAction(config, options, targetPath)
      await outputResult()
      const watchInterval = parseTimeString(options.watch)
      setInterval(async () => {
        await cloneAction(config, options, targetPath)
        await outputResult()
      }, watchInterval)
    } else {
      await cloneAction(config, options, targetPath)
      await outputResult()
      process.exit(0)
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(bold(`\n${red("Error: ")}`) + err.message)
    } else {
      console.log(bold(`${red("\nUnexpected Error: ")}`) + JSON.stringify(err, null, 2))
    }
    process.exit(1)
  }
}

main()
