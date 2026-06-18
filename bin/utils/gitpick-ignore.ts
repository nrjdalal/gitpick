import fs from "node:fs"
import path from "node:path"

export type IgnoreMatcher = {
  ignores: (relPath: string, isDir: boolean) => boolean
}

type Rule = {
  negated: boolean
  dirOnly: boolean
  regex: RegExp
}

const escapeChar = (c: string) => (/[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c)

// Translate a gitignore-style glob into a regex body (no anchors).
// `*` -> within a segment, `**` -> across segments, `?` -> one non-slash char.
const toRegexBody = (pattern: string): string => {
  let body = ""
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        const prevSlash = i === 0 || pattern[i - 1] === "/"
        i += 2
        const nextSlash = pattern[i] === "/"
        if (prevSlash && nextSlash) {
          // "**/" — zero or more leading directories
          body += "(?:.*/)?"
          i += 1
        } else {
          // "**" elsewhere — match anything, slashes included
          body += ".*"
        }
      } else {
        body += "[^/]*"
        i += 1
      }
    } else if (c === "?") {
      body += "[^/]"
      i += 1
    } else if (c === "/") {
      body += "/"
      i += 1
    } else {
      body += escapeChar(c)
      i += 1
    }
  }
  return body
}

const compile = (raw: string): Rule | null => {
  let pattern = raw.trim()
  if (!pattern || pattern.startsWith("#")) return null

  let negated = false
  if (pattern.startsWith("!")) {
    negated = true
    pattern = pattern.slice(1)
  }

  let dirOnly = false
  if (pattern.endsWith("/")) {
    dirOnly = true
    pattern = pattern.replace(/\/+$/, "")
  }

  // A leading slash, or any embedded slash, anchors the pattern to the root.
  // Otherwise it matches the basename at any depth.
  let anchored = false
  if (pattern.startsWith("/")) {
    anchored = true
    pattern = pattern.replace(/^\/+/, "")
  } else if (pattern.includes("/")) {
    anchored = true
  }

  if (!pattern) return null

  const body = toRegexBody(pattern)
  const source = anchored ? `^${body}$` : `^(?:.*/)?${body}$`
  return { negated, dirOnly, regex: new RegExp(source) }
}

export const parseIgnore = (content: string): IgnoreMatcher => {
  const rules: Rule[] = []
  for (const line of content.split(/\r?\n/)) {
    const rule = compile(line)
    if (rule) rules.push(rule)
  }

  return {
    ignores(relPath, isDir) {
      const p = relPath.split(path.sep).join("/")
      if (!p || p === ".") return false
      // Last matching rule wins, so a later `!pattern` can re-include.
      let ignored = false
      for (const rule of rules) {
        if (rule.dirOnly && !isDir) continue
        if (rule.regex.test(p)) ignored = !rule.negated
      }
      return ignored
    },
  }
}

// Load `<root>/.gitpickignore` into a matcher, or null when absent.
export const loadIgnore = (root: string): IgnoreMatcher | null => {
  let content: string
  try {
    content = fs.readFileSync(path.join(root, ".gitpickignore"), "utf8")
  } catch {
    return null
  }
  return parseIgnore(content)
}
