// Trimmed from yocto-spinner by Sindre Sorhus (https://github.com/sindresorhus/yocto-spinner)
import process from "node:process"
import { stripVTControlCharacters } from "node:util"

import { cyan, green } from "@/external/yoctocolors"

const isUnicodeSupported =
  process.platform !== "win32" ||
  Boolean(process.env.WT_SESSION) ||
  process.env.TERM_PROGRAM === "vscode"

const isInteractive = (stream: NodeJS.WriteStream) =>
  Boolean(stream.isTTY && process.env.TERM !== "dumb" && !("CI" in process.env))

const successSymbol = green(isUnicodeSupported ? "✔" : "√")

const frames = isUnicodeSupported
  ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  : ["-", "\\", "|", "/"]
const interval = 80

export const spinner = (options: { text?: string; stream?: NodeJS.WriteStream } = {}) => {
  let currentFrame = -1
  let timer: ReturnType<typeof setInterval> | undefined
  let text = options.text ?? ""
  const stream = options.stream ?? process.stderr
  const interactive = isInteractive(stream)
  let lines = 0
  let lastFrameTime = 0
  let spinning = false

  const write = (str: string) => stream.write(str)

  const clear = () => {
    if (!interactive || lines === 0) return
    stream.cursorTo(0)
    for (let i = 0; i < lines; i++) {
      if (i > 0) stream.moveCursor(0, -1)
      stream.clearLine(1)
    }
    lines = 0
  }

  const lineCount = (str: string) => {
    const width = stream.columns ?? 80
    const stripped = stripVTControlCharacters(str).split("\n")
    let count = 0
    for (const line of stripped) {
      count += Math.max(1, Math.ceil(line.length / width))
    }
    return count
  }

  const render = () => {
    const now = Date.now()
    if (currentFrame === -1 || now - lastFrameTime >= interval) {
      currentFrame = ++currentFrame % frames.length
      lastFrameTime = now
    }
    const frame = frames[currentFrame]
    const string = `${cyan(frame)} ${text}`
    if (interactive) {
      clear()
      write(string)
      lines = lineCount(string)
    } else {
      write(string + "\n")
    }
  }

  return {
    start(t: string) {
      text = t
      spinning = true
      if (interactive) write("\x1B[?25l")
      render()
      if (interactive) {
        timer = setInterval(render, interval)
      }
      return this
    },
    success(t: string) {
      if (!spinning) return this
      spinning = false
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      clear()
      if (interactive) write("\x1B[?25h")
      write(`${successSymbol} ${t ?? text}\n`)
      return this
    },
  }
}
