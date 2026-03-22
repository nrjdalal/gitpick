#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"

import spawn from "@/external/nano-spawn"
import { spinner } from "@/external/yocto-spinner"
import { bold, cyan, green, red, yellow } from "@/external/yoctocolors"
import { cloneAction } from "@/utils/clone-action"
import { copyDir } from "@/utils/copy-dir"
import { type TreeEntry, interactivePicker } from "@/utils/interactive-picker"
import { parseTimeString } from "@/utils/parse-time-string"
import { configFromUrl } from "@/utils/transform-url"
import { notifyUpdate, scheduleUpdateCheck } from "@/utils/update-notifier"
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
  ${cyan("-i, --interactive")}  Browse and pick files/folders interactively
  ${cyan("-n, --dry-run")}      Show what would be cloned without cloning
  ${cyan("-o, --overwrite")}    Skip overwrite prompt
  ${cyan("-r, --recursive")}    Clone submodules
  ${cyan("-w, --watch [time]")} Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s)
  ${cyan("    --tree")}         List copied files as a tree
  ${cyan("-q, --quiet")}        Suppress all output except errors
  ${cyan("    --verbose")}      Show detailed clone information
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
      const linkTarget = await fs.promises.readlink(entryPath)
      let resolvedIsDir = false
      try {
        resolvedIsDir = fs.statSync(entryPath).isDirectory()
      } catch {}
      process.stdout.write(
        `${prefix}${connector}${yellow(entry.name)} -> ${resolvedIsDir ? cyan(linkTarget) : linkTarget}\n`,
      )
    } else if (entry.isDirectory()) {
      process.stdout.write(`${prefix}${connector}${cyan(entry.name)}\n`)
      await printTree(entryPath, `${prefix}${last ? "    " : "│   "}`)
    } else {
      process.stdout.write(`${prefix}${connector}${entry.name}\n`)
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
  scheduleUpdateCheck()

  try {
    const { positionals, values } = parse({
      allowPositionals: true,
      options: {
        branch: { type: "string", short: "b" },
        "dry-run": { type: "boolean", short: "n" },
        force: { type: "boolean", short: "f" },
        help: { type: "boolean", short: "h" },
        interactive: { type: "boolean", short: "i" },
        quiet: { type: "boolean", short: "q" },
        tree: { type: "boolean" },
        verbose: { type: "boolean" },
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
      interactive: values.interactive,
      quiet: values.quiet,
      tree: values.tree,
      verbose: values.verbose,
      overwrite: values.overwrite,
      recursive: values.recursive,
      watch: values.watch,
    }

    const silent = options.tree || options.quiet

    if (!silent) {
      console.log(
        `\nWith ${bold(`${terminalLink("GitPick", "https://github.com/nrjdalal/gitpick")}`)} clone specific files, folders, branches,\ncommits and much more from GitHub, GitLab and Bitbucket!`,
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

    if (options.interactive) {
      if (!process.stdout.isTTY) {
        throw new Error("Interactive mode requires a TTY")
      }

      // Shallow clone to temp first
      const tempDir = path.resolve(
        os.tmpdir(),
        `gitpick-interactive-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
      )
      const repoUrl = `https://${config.token ? config.token + "@" : ""}${config.host}/${config.owner}/${config.repository}.git`

      const s = spinner()
      s.start(`Fetching ${config.owner}/${config.repository}...`)

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
        await spawn("git", [
          "clone",
          repoUrl,
          tempDir,
          ...(options.recursive ? ["--recursive"] : []),
        ])
        await spawn("git", ["checkout", config.branch], { cwd: tempDir })
      }

      // Walk local tree to build entries (scoped to config.path if set)
      const walkRoot = config.path ? path.join(tempDir, config.path) : tempDir
      const entries: TreeEntry[] = []
      async function walkDir(dir: string, rel: string) {
        const items = await fs.promises.readdir(dir, { withFileTypes: true })
        for (const item of items) {
          if (item.name === ".git") continue
          const itemRel = rel ? `${rel}/${item.name}` : item.name
          const itemPath = path.join(dir, item.name)
          if (item.isSymbolicLink()) {
            const linkTarget = await fs.promises.readlink(itemPath)
            let resolvedIsDir = false
            try {
              resolvedIsDir = (await fs.promises.stat(itemPath)).isDirectory()
            } catch {}
            entries.push({
              path: itemRel,
              type: "symlink",
              linkTarget: resolvedIsDir ? linkTarget + "/" : linkTarget,
            })
          } else if (item.isDirectory()) {
            entries.push({ path: itemRel, type: "tree" })
            await walkDir(itemPath, itemRel)
          } else {
            const stat = await fs.promises.stat(itemPath)
            entries.push({ path: itemRel, type: "blob", size: stat.size })
          }
        }
      }
      await walkDir(walkRoot, "")

      s.success(`Fetched ${config.owner}/${config.repository} (${entries.length} entries)`)

      if (!entries.length) {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
        console.log(yellow("\nRepository has no files."))
        process.exit(0)
      }

      const selected = await interactivePicker(
        entries,
        `${config.owner}/${config.repository} ${cyan("repository:" + config.branch)} > ${green(config.target)}`,
        walkRoot,
      )

      if (!selected.length) {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
        console.log("\nNo files selected.")
        process.exit(0)
      }

      // Dry run - just show what would be picked
      if (options.dryRun) {
        console.log(
          `\n${green("✔")} Would pick ${selected.length} path${selected.length !== 1 ? "s" : ""}:`,
        )
        for (const sel of selected) console.log(`  ${sel}`)
        await fs.promises.rm(tempDir, { recursive: true, force: true })
        console.log()
        notifyUpdate(version, false)
        process.exit(0)
      }

      console.log(
        `\n${green("✔")} Picking ${selected.length} selected path${selected.length !== 1 ? "s" : ""}...`,
      )

      // Overwrite guard
      if (fs.existsSync(targetPath) && !options.overwrite) {
        if ((await fs.promises.readdir(targetPath)).length) {
          await fs.promises.rm(tempDir, { recursive: true, force: true })
          console.log(
            `${yellow(`\nWarning: The target directory exists at ${green(config.target)} and is not empty. Use ${cyan("-f")} or ${cyan("-o")} to overwrite.`)}`,
          )
          process.exit(1)
        }
      }

      await fs.promises.mkdir(targetPath, { recursive: true })

      let copiedFiles = 0
      for (const sel of selected) {
        const src = path.join(walkRoot, sel)
        const dest = path.join(targetPath, sel)
        const stat = await fs.promises.stat(src).catch(() => null)
        if (!stat) continue

        if (stat.isDirectory()) {
          await fs.promises.mkdir(dest, { recursive: true })
          const files = await copyDir(src, dest)
          copiedFiles += files.length
        } else {
          await fs.promises.mkdir(path.dirname(dest), { recursive: true })
          await fs.promises.copyFile(src, dest)
          copiedFiles++
        }
      }

      await fs.promises.rm(tempDir, { recursive: true, force: true })

      console.log(
        green(
          `✔ Copied ${copiedFiles} file${copiedFiles !== 1 ? "s" : ""} to ${displayPath(targetPath)}`,
        ),
      )
      if (options.tree) {
        process.stdout.write(`\n${bold(cyan(displayPath(targetPath)))}\n`)
        await printTree(targetPath)
        process.stdout.write("\n")
      }
      notifyUpdate(version, false)
      process.exit(0)
    }

    const renderTree = async (clonedPath: string) => {
      if (fs.statSync(clonedPath).isDirectory()) {
        process.stdout.write(`${bold(cyan(displayPath(targetPath)))}\n`)
        await printTree(clonedPath)
      } else {
        process.stdout.write(`${bold(cyan(displayPath(path.dirname(targetPath))))}\n`)
        process.stdout.write(`└── ${path.basename(targetPath)}\n`)
      }
      process.stdout.write("\n")
    }

    if (options.dryRun) {
      if (options.tree) {
        const tempTarget = path.resolve(
          os.tmpdir(),
          `gitpick-dry-${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
        )
        try {
          await cloneAction(config, options, tempTarget)
          await renderTree(tempTarget)
        } finally {
          await fs.promises.rm(tempTarget, { recursive: true, force: true })
        }
      }
      if (!silent) console.log()
      notifyUpdate(version, silent)
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

    if (options.watch) {
      if (!silent)
        console.log(`\n👀 Watching every ${parseTimeString(options.watch) / 1000 + "s"}\n`)
      await cloneAction(config, options, targetPath)
      if (options.tree) await renderTree(targetPath)
      const watchInterval = parseTimeString(options.watch)
      setInterval(async () => {
        await cloneAction(config, options, targetPath)
        if (options.tree) await renderTree(targetPath)
      }, watchInterval)
    } else {
      await cloneAction(config, options, targetPath)
      if (options.tree) await renderTree(targetPath)
      notifyUpdate(version, silent)
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
