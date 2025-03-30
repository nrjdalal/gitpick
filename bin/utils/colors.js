import tty from "node:tty"

const hasColors = tty?.WriteStream?.prototype?.hasColors?.() ?? false

const format = (open, close) => {
  if (!hasColors) {
    return (input) => input
  }

  const openCode = `\u001B[${open}m`
  const closeCode = `\u001B[${close}m`

  return (input) => {
    const string = input + ""
    let index = string.indexOf(closeCode)

    if (index === -1) return openCode + string + closeCode

    let result = openCode
    let lastIndex = 0

    while (index !== -1) {
      result += string.slice(lastIndex, index) + openCode
      lastIndex = index + closeCode.length
      index = string.indexOf(closeCode, lastIndex)
    }

    result += string.slice(lastIndex) + closeCode

    return result
  }
}

export const reset = format(0, 0)
export const bold = format(1, 22)
export const dim = format(2, 22)
export const italic = format(3, 23)
export const underline = format(4, 24)
export const overline = format(53, 55)
export const inverse = format(7, 27)
export const hidden = format(8, 28)
export const strikethrough = format(9, 29)

export const black = format(30, 39)
export const red = format(31, 39)
export const green = format(32, 39)
export const yellow = format(33, 39)
export const blue = format(34, 39)
export const magenta = format(35, 39)
export const cyan = format(36, 39)
export const white = format(37, 39)
export const gray = format(90, 39)
