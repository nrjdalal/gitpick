// Trimmed from nano-spawn by Sindre Sorhus (https://github.com/sindresorhus/nano-spawn)
import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process"
import { once } from "node:events"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"

class SubprocessError extends Error {
  name = "SubprocessError"
  stdout = ""
  stderr = ""
  exitCode?: number
}

const exeExtensions = [".exe", ".com"]

const EXE_MEMO: Record<string, Promise<boolean>> = {}
const memoize =
  (fn: (...args: string[]) => Promise<boolean>) =>
  (...args: string[]) =>
    (EXE_MEMO[args.join("\0")] ??= fn(...args))

const access = memoize(async (...args: string[]) => {
  try {
    await fs.access(args[0])
    return true
  } catch {
    return false
  }
})

const mIsExe = memoize(async (file: string, cwd: string, PATH: string) => {
  const parts = PATH.split(path.delimiter)
    .filter(Boolean)
    .map((part) => part.replace(/^"(.*)"$/, "$1"))
  try {
    await Promise.any(
      [cwd, ...parts].flatMap((part) =>
        exeExtensions.map((ext) => access(`${path.resolve(part, file)}${ext}`)),
      ),
    )
  } catch {
    return false
  }
  return true
})

const shouldForceShell = async (file: string, options: SpawnOptions): Promise<boolean> =>
  process.platform === "win32" &&
  !options.shell &&
  !exeExtensions.some((ext) => file.toLowerCase().endsWith(ext)) &&
  !(await mIsExe(
    file,
    (options.cwd as string) ?? ".",
    (process.env.PATH || process.env.Path) ?? "",
  ))

const escapeFile = (file: string) => file.replaceAll(/([()\][%!^"`<>&|;, *?])/g, "^$1")
const escapeArgument = (arg: string) =>
  escapeFile(escapeFile(`"${arg.replaceAll(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`))

const getCommandPart = (part: string) =>
  /[^\w./-]/.test(part) ? `'${part.replaceAll("'", "'\\''")}'` : part

export default async function spawn(
  file: string,
  args: string[] = [],
  options: Record<string, any> = {},
): Promise<{ stdout: string; stderr: string }> {
  const {
    stdin,
    stdout: stdoutOpt,
    stderr: stderrOpt,
    stdio,
    cwd: cwdOpt = ".",
    env: envOpt,
    ...rest
  } = options
  const cwd = cwdOpt instanceof URL ? fileURLToPath(cwdOpt) : path.resolve(cwdOpt)
  const env = envOpt ? { ...process.env, ...envOpt } : undefined
  const resolvedStdio = stdio ?? [stdin, stdoutOpt, stderrOpt]

  const command = [file, ...args]
    .map((part) => getCommandPart(stripVTControlCharacters(part)))
    .join(" ")

  if (["node", "node.exe"].includes(file.toLowerCase())) {
    file = process.execPath
    args = [...process.execArgv.filter((flag) => !flag.startsWith("--inspect")), ...args]
  }

  let spawnOpts: SpawnOptions = { ...rest, stdio: resolvedStdio, env, cwd }

  if (await shouldForceShell(file, spawnOpts)) {
    args = args.map((arg) => escapeArgument(arg))
    file = escapeFile(file)
    spawnOpts = { ...spawnOpts, shell: true }
  }

  if (spawnOpts.shell && args.length > 0) {
    file = [file, ...args].join(" ")
    args = []
  }

  const instance = nodeSpawn(file, args, spawnOpts)

  let stdoutData = ""
  let stderrData = ""
  if (instance.stdout) {
    instance.stdout.setEncoding("utf8")
    instance.stdout.on("data", (chunk: string) => (stdoutData += chunk))
  }
  if (instance.stderr) {
    instance.stderr.setEncoding("utf8")
    instance.stderr.on("data", (chunk: string) => (stderrData += chunk))
  }

  instance.once("error", () => {})

  try {
    await once(instance, "spawn")
  } catch (error) {
    throw Object.assign(new SubprocessError(`Command failed: ${command}`, { cause: error }), {
      stdout: stdoutData,
      stderr: stderrData,
    })
  }

  await once(instance, "close")

  const trimOutput = (s: string) =>
    s.at(-1) === "\n" ? s.slice(0, s.at(-2) === "\r" ? -2 : -1) : s

  if (instance.exitCode && instance.exitCode > 0) {
    throw Object.assign(
      new SubprocessError(`Command failed with exit code ${instance.exitCode}: ${command}`),
      {
        stdout: trimOutput(stdoutData),
        stderr: trimOutput(stderrData),
        exitCode: instance.exitCode,
      },
    )
  }

  if (instance.signalCode) {
    throw Object.assign(
      new SubprocessError(`Command was terminated with ${instance.signalCode}: ${command}`),
      { stdout: trimOutput(stdoutData), stderr: trimOutput(stderrData) },
    )
  }

  return { stdout: trimOutput(stdoutData), stderr: trimOutput(stderrData) }
}
