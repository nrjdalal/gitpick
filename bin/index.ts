#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { cloneAction } from "@/utils/clone-action"
import { parseTimeString } from "@/utils/parse-time-string"
import { githubConfigFromUrl } from "@/utils/transform-url"
import terminalLink from "~/external/terminal-link"
import { bold, cyan, green, red, yellow } from "~/external/yoctocolors"
import { name, version } from "~/package.json"

const helpMessage = `
With ${bold(`${terminalLink("GitPick", "https://github.com/nrjdalal/gitpick")}`)} clone specific directories or files from GitHub!

  $ gitpick ${yellow("<url>")} ${green("[target]")} ${cyan("[options]")}

${bold("Hint:")}
  [target] and [options] are optional and if not specified,
  GitPick fallbacks to the default behavior of \`git clone\`

${bold("Arguments:")}
  ${yellow("url")}                GitHub URL with path to file/folder/repository
  ${green("target")}             Directory to clone into (optional)

${bold("Options:")}
  ${cyan("-b, --branch ")}      Branch/SHA to clone
  ${cyan("-o, --overwrite")}    Skip overwrite prompt
  ${cyan("-r, --recursive")}    Clone submodules
  ${cyan("-w, --watch [time]")} Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s)
  ${cyan("-h, --help")}         display help for command
  ${cyan("-v, --version")}      display the version number

${bold("Examples:")}
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch/SHA]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch/SHA] -w [time]
  
🚀 More awesome tools at ${cyan("https://github.com/nrjdalal")}`

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
        force: { type: "boolean", short: "f" },
        help: { type: "boolean", short: "h" },
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
      console.log(helpMessage)
      process.exit(0)
    }

    if (positionals[0] === "clone") {
      positionals.shift()
    }

    let [url, target] = positionals

    const options = {
      branch: values.branch,
      force: values.force,
      overwrite: values.overwrite,
      recursive: values.recursive,
      watch: values.watch,
    }

    console.log(
      `\nWith ${bold(`${terminalLink("GitPick", "https://github.com/nrjdalal/gitpick")}`)} clone specific directories or files from GitHub!`,
    )

    const config = await githubConfigFromUrl(url, {
      branch: options.branch,
      target,
    })

    if (config.type === "blob") {
      const parts = config.target.split("/").filter((part) => part !== "")
      let lastPart = parts[parts.length - 1]
      if (lastPart !== "." && lastPart !== ".." && lastPart.includes(".")) {
        parts.pop()
      } else {
        lastPart = config.path.split("/").pop() || lastPart
      }
      config.target = [...parts, lastPart].join("/")
    }

    console.info(
      `\n${green("✔")} ${config.owner}/${config.repository} ${cyan(config.type + ":" + config.branch)} ${
        config.type === "repository"
          ? `> ${green(config.target)}`
          : `${!config.path.length ? ">" : yellow(config.path) + " >"} ${green(config.target)}`
      }`,
    )

    const targetPath = path.resolve(config.target)
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
      console.log(`\n👀 Watching every ${parseTimeString(options.watch) / 1000 + "s"}\n`)
      await cloneAction(config, options, targetPath)
      const watchInterval = parseTimeString(options.watch)
      setInterval(async () => await cloneAction(config, options, targetPath), watchInterval)
    } else {
      await cloneAction(config, options, targetPath)
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
