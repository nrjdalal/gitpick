export function parseTimeString(timeString: string | number): number {
  if (typeof timeString === "number" || /^\d+$/.test(timeString)) {
    return typeof timeString === "number" ? timeString : parseInt(timeString, 10)
  }

  const regex = /(\d+)([hms])/g
  let totalMilliseconds = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(timeString)) !== null) {
    const value = parseInt(match[1], 10)
    const unit = match[2] as "h" | "m" | "s"

    switch (unit) {
      case "h":
        totalMilliseconds += value * 3600000
        break
      case "m":
        totalMilliseconds += value * 60000
        break
      case "s":
        totalMilliseconds += value * 1000
        break
    }
  }

  return totalMilliseconds
}
