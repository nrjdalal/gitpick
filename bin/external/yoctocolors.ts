// Trimmed from yoctocolors by Sindre Sorhus (https://github.com/sindresorhus/yoctocolors)
import tty from "node:tty"

const hasColors = tty?.WriteStream?.prototype?.hasColors?.() ?? false

const format = (open: number, close: number) => {
  if (!hasColors) {
    return (input: string) => input
  }

  const openCode = `\u001B[${open}m`
  const closeCode = `\u001B[${close}m`

  return (input: string) => {
    const string = input + ""
    let index = string.indexOf(closeCode)

    if (index === -1) {
      return openCode + string + closeCode
    }

    let result = openCode
    let lastIndex = 0

    const reopenOnNestedClose = close === 22
    const replaceCode = (reopenOnNestedClose ? closeCode : "") + openCode

    while (index !== -1) {
      result += string.slice(lastIndex, index) + replaceCode
      lastIndex = index + closeCode.length
      index = string.indexOf(closeCode, lastIndex)
    }

    result += string.slice(lastIndex) + closeCode

    return result
  }
}

export const bold = format(1, 22)
export const dim = format(2, 22)
export const red = format(31, 39)
export const green = format(32, 39)
export const yellow = format(33, 39)
export const cyan = format(36, 39)
