#!/usr/bin/env node
import { clone } from "@/commands/clone"
import chalk from "chalk"
import { Command } from "commander"
import packageJson from "../package.json"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
  const program = new Command()
    .name("gitpick")
    .description("With gitpick, you can clone precisely what you need.")
    .version(
      packageJson.version || "1.0.0",
      "-v, --version",
      "display the version number",
    )

  const args = process.argv.slice(2)
  const validCommands = ["-v", "--version", "-h", "--help", "help", "clone"]
  if (args.length && !validCommands.includes(args[0])) {
    process.argv.splice(2, 0, "clone")
  }

  program.addCommand(clone)

  program.configureHelp({
    formatHelp: () => {
      return `${chalk.bold("With gitpick, you can clone precisely what you need.")}

🚀 More awesome tools at ${chalk.cyan("https://github.com/nrjdalal")}

-------------------------------------
  ${chalk.cyan("gitpick <url>")} ${chalk.green("[target]")} ${chalk.blue("[options]")}
-------------------------------------

${chalk.bold("Hint:")} Target is optional, and follows default git clone behavior.

${chalk.bold("Arguments:")}
  ${chalk.cyan("url")}                GitHub URL with path to file/folder
  ${chalk.green("target")}             Directory to clone into (optional)

${chalk.bold("Options:")}
  ${chalk.blue("-b, --branch ")}      Branch to clone
  ${chalk.blue("-o, --overwrite")}    Skip overwrite prompt
  ${chalk.blue("-w, --watch [time]")} Watch the repository and sync every [time]
                                      (e.g. 1h, 30m, 15s) default: 1m
  ${chalk.blue("-h, --help")}         display help for command
  ${chalk.blue("-v, --version")}      display the version number

${chalk.bold("Examples:")}
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch] -w [time]
`
    },
  })

  console.log(`\ngitpick v${packageJson.version}\n`)

  program.parse()
}

main()
