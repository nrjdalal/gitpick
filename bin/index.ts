#!/usr/bin/env node
import fs from "fs"
import { parseArgs } from "node:util"
import path from "path"
import { cloneAction } from "@/utils/clone-action"
import { parseTimeString } from "@/utils/parse-time-string"
import { githubConfigFromUrl } from "@/utils/transform-url"
import { bold, cyan, green, white, yellow } from "~/external/yoctocolors/base"
import { name, version } from "~/package.json"

const helpMessage = `
${bold("With GitPick, you can clone precisely what you need.")}

${cyan("gitpick <url>")} ${green("[target]")} ${cyan("[options]")}

${bold("Hint:")} Target is optional, and follows default git clone behavior.

${bold("Arguments:")}
  ${cyan("url")}                GitHub URL with path to file/folder/repository
  ${green("target")}             Directory to clone into (optional)

${bold("Options:")}
  ${cyan("-b, --branch ")}      Branch to clone
  ${cyan("-o, --overwrite")}    Skip overwrite prompt
  ${cyan("-w, --watch [time]")} Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s) default: 1m
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
        overwrite: { type: "boolean", short: "o" },
        force: { type: "boolean", short: "f" },
        watch: { type: "string", short: "w" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    })

    if (!positionals.length) {
      if (values.version) {
        console.log(`${name}@${version}`)
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
      overwrite: values.overwrite,
      force: values.force,
      watch: values.watch,
    }

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

    // TODO: Hyperlink to GitHub repo

    // console.log(
    //   white(
    //     `\n${terminalLink("GitPick ↗️ ", "https://github.com/nrjdalal/gitpick")} - Clone specific directories or files from GitHub!\n`,
    //   ),
    // )

    console.log(
      white(
        `\n${bold("GitPick")} - Clone specific directories or files from GitHub!\n`,
      ),
    )

    console.info(
      `${bold(config.owner)}/${bold(config.repository)} ${green(
        `<${config.type}:${config.branch}>`,
      )} ${
        config.type === "repository"
          ? `> ${cyan(config.target)}`
          : `${yellow(config.path)} > ${cyan(
              `${config.target}${
                config.type === "blob" ? `/${config.path.split("/").pop()}` : ""
              }`,
            )}`
      }\n`,
    )

    const targetPath = path.resolve(config.target)

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
          `${yellow(`Warning: The target directory is not empty. Use ${cyan("-f")} | ${cyan("-o")} to overwrite.`)}`,
        ),
      )
      process.exit(0)
    }

    await cloneAction(config, options, targetPath)

    if (options.watch) {
      const watchInterval = parseTimeString(options.watch)
      setInterval(
        async () => await cloneAction(config, options, targetPath),
        watchInterval,
      )
    }

    process.exit(0)
  } catch (err: any) {
    console.error(`\nError: ${err.message}`)
    process.exit(1)
  }
}

main()
