#!/usr/bin/env node
import { clone } from "@/commands/clone"
import { Command } from "commander"
import terminalLink from "terminal-link"
import colors from "yoctocolors"
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
      return `${colors.bold("With gitpick, you can clone precisely what you need.")}

🚀 More awesome tools at ${colors.cyan("https://github.com/nrjdalal")}

-------------------------------------
  ${colors.cyan("gitpick <url>")} ${colors.green("[target]")} ${colors.blue("[options]")}
-------------------------------------

${colors.bold("Hint:")} Target is optional, and follows default git clone behavior.

${colors.bold("Arguments:")}
  ${colors.cyan("url")}                GitHub URL with path to file/folder
  ${colors.green("target")}             Directory to clone into (optional)

${colors.bold("Options:")}
  ${colors.blue("-b, --branch ")}      Branch to clone
  ${colors.blue("-o, --overwrite")}    Skip overwrite prompt
  ${colors.blue("-w, --watch [time]")} Watch the repository and sync every [time]
                                      (e.g. 1h, 30m, 15s) default: 1m
  ${colors.blue("-h, --help")}         display help for command
  ${colors.blue("-v, --version")}      display the version number

${colors.bold("Examples:")}
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch] -w [time]
`
    },
  })

  console.log(
    `\n${terminalLink("GitPick ↗️ ", "https://github.com/nrjdalal/gitpick")} - Clone specific directories or files from GitHub!\n`,
  )

  program.parse()
}

main()
