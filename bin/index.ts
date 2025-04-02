#!/usr/bin/env node
import fs from "fs"
import { parseArgs } from "node:util"
import path from "path"
import { cloneAction } from "@/utils/clone-action"
import { bold, cyan, green, red, yellow } from "@/utils/colors"
import { parseTimeString } from "@/utils/parse-time-string"
import { githubConfigFromUrl } from "@/utils/transform-url"
import { name, version } from "~/package.json"

const helpMessage = `
${bold("With GitPick, you can clone precisely what you need.")}

${bold("gitpick")} ${yellow("<url>")} ${green("[target]")} ${cyan("[options]")}

${bold("Hint:")} Target is optional, and follows default git clone behavior.

${bold("Arguments:")}
  ${yellow("url")}                GitHub URL with path to file/folder/repository
  ${green("target")}             Directory to clone into (optional)

${bold("Options:")}
  ${cyan("-b, --branch ")}      Branch to clone
  ${cyan("-o, --overwrite")}    Skip overwrite prompt
  ${cyan("-r, --recursive")}    Clone submodules
  ${cyan("-w, --watch [time]")} Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s)
  ${cyan("-h, --help")}         display help for command
  ${cyan("-v, --version")}      display the version number

${bold("Examples:")}
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch] -w [time]
  
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

    // TODO: Hyperlink to GitHub repo

    // console.log(
    //   white(
    //     `\n${terminalLink("GitPick ↗️ ", "https://github.com/nrjdalal/gitpick")} - Clone specific directories or files from GitHub!\n`,
    //   ),
    // )

    console.log(
      `\n${bold("GitPick")} - Clone specific directories or files from GitHub!`,
    )

    const config = await githubConfigFromUrl(url, {
      branch: options.branch,
      target,
    })

    if (config.type === "blob") {
      const parts = config.target.split("/").filter((part) => part !== "")
      const lastPart = parts[parts.length - 1]
      if (lastPart !== "." && lastPart !== ".." && lastPart.includes(".")) {
        parts.pop()
      }
      config.target = parts.join("/")
    }

    console.info(
      `\n${bold(config.owner)}/${bold(config.repository)} ${green(
        `<${config.type}:${config.branch}>`,
      )} ${
        config.type === "repository"
          ? `> ${cyan(config.target)}`
          : `${yellow(config.path)} > ${cyan(
              `${config.target}${
                config.type === "blob" ? `/${config.path.split("/").pop()}` : ""
              }`,
            )}`
      }`,
    )

    const targetPath = path.resolve(config.target)
    options.overwrite = options.overwrite || options.force
    if (options.watch) options.overwrite = true

    if (
      fs.existsSync(
        targetPath +
          (config.type === "blob" ? "/" + config.path.split("/").pop() : ""),
      ) &&
      (await fs.promises.readdir(targetPath)).length &&
      !options.overwrite
    ) {
      console.log(
        bold(
          `${yellow(`\nWarning: The target directory is not empty. Use ${cyan("-f")} | ${cyan("-o")} to overwrite.`)}`,
        ),
      )
      process.exit(0)
    }

    if (options.watch) {
      console.log(
        `\n👀 Watching every ${parseTimeString(options.watch) / 1000 + "s"}\n`,
      )

      await cloneAction(config, options, targetPath)
      const watchInterval = parseTimeString(options.watch)
      setInterval(
        async () => await cloneAction(config, options, targetPath),
        watchInterval,
      )
    } else {
      await cloneAction(config, options, targetPath)
      process.exit(0)
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(bold(`\n${red("Error: ")}`) + err.message)
    } else {
      console.log(
        bold(`${red("\nUnexpected Error: ")}`) + JSON.stringify(err, null, 2),
      )
    }
    process.exit(1)
  }
}

main()
