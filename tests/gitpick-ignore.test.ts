import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { copyDir } from "../bin/utils/copy-dir"
import { parseIgnore } from "../bin/utils/gitpick-ignore"

// --- matcher unit tests ---

describe("gitpick-ignore matcher", () => {
  it("anchored directory pattern matches the dir, not unrelated paths", () => {
    const m = parseIgnore("web/next/public/landing/\n")
    expect(m.ignores("web/next/public/landing", true)).toBe(true)
    expect(m.ignores("web/next/public", true)).toBe(false)
    expect(m.ignores("web/next/public/keep", true)).toBe(false)
  })

  it("dir-only pattern does not match a file of the same path", () => {
    const m = parseIgnore("build/\n")
    expect(m.ignores("build", true)).toBe(true)
    expect(m.ignores("build", false)).toBe(false)
  })

  it("basename pattern matches at any depth", () => {
    const m = parseIgnore("node_modules\n")
    expect(m.ignores("node_modules", true)).toBe(true)
    expect(m.ignores("a/b/node_modules", true)).toBe(true)
    expect(m.ignores("a/node_modules_keep", true)).toBe(false)
  })

  it("* stays within a segment", () => {
    const m = parseIgnore("*.log\n")
    expect(m.ignores("error.log", false)).toBe(true)
    expect(m.ignores("logs/error.log", false)).toBe(true)
    expect(m.ignores("error.log.txt", false)).toBe(false)
  })

  it("**/ matches across segments", () => {
    const m = parseIgnore("**/landing\n")
    expect(m.ignores("landing", true)).toBe(true)
    expect(m.ignores("a/b/landing", true)).toBe(true)
  })

  it("! re-includes a previously ignored path (last rule wins)", () => {
    const m = parseIgnore("*.svg\n!logo.svg\n")
    expect(m.ignores("icon.svg", false)).toBe(true)
    expect(m.ignores("logo.svg", false)).toBe(false)
    expect(m.ignores("assets/logo.svg", false)).toBe(false)
  })

  it("ignores comments and blank lines", () => {
    const m = parseIgnore("# a comment\n\n  \nfoo\n")
    expect(m.ignores("foo", false)).toBe(true)
    expect(m.ignores("bar", false)).toBe(false)
  })

  it("anchored leading-slash pattern only matches at root", () => {
    const m = parseIgnore("/foo\n")
    expect(m.ignores("foo", false)).toBe(true)
    expect(m.ignores("a/foo", false)).toBe(false)
  })
})

// --- copyDir integration tests ---

describe("copyDir honours .gitpickignore", () => {
  let root: string
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gitpick-ignore-test-"))
  })
  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function makeSource(name: string, ignore?: string) {
    const src = join(root, name, "src")
    mkdirSync(join(src, "public", "landing"), { recursive: true })
    mkdirSync(join(src, "keep"), { recursive: true })
    writeFileSync(join(src, "public", "landing", "hero.png"), "img")
    writeFileSync(join(src, "public", "logo.svg"), "svg")
    writeFileSync(join(src, "public", "icon.svg"), "svg")
    writeFileSync(join(src, "keep", "app.ts"), "code")
    writeFileSync(join(src, "README.md"), "readme")
    writeFileSync(join(src, "secret.env"), "x")
    if (ignore !== undefined) writeFileSync(join(src, ".gitpickignore"), ignore)
    return src
  }

  it("excludes a directory and a file; never copies .gitpickignore itself", async () => {
    const src = makeSource("exclude", "public/landing/\n*.env\n")
    const dest = join(root, "exclude", "dest")
    await copyDir(src, dest)
    expect(existsSync(join(dest, "public", "landing"))).toBe(false)
    expect(existsSync(join(dest, "secret.env"))).toBe(false)
    expect(existsSync(join(dest, "public", "logo.svg"))).toBe(true)
    expect(existsSync(join(dest, "keep", "app.ts"))).toBe(true)
    expect(existsSync(join(dest, "README.md"))).toBe(true)
    expect(existsSync(join(dest, ".gitpickignore"))).toBe(false)
  })

  it("copies everything when no .gitpickignore is present", async () => {
    const src = makeSource("none")
    const dest = join(root, "none", "dest")
    await copyDir(src, dest)
    expect(existsSync(join(dest, "public", "landing", "hero.png"))).toBe(true)
    expect(existsSync(join(dest, "secret.env"))).toBe(true)
    expect(existsSync(join(dest, "public", "icon.svg"))).toBe(true)
  })

  it("! negation re-includes a file", async () => {
    const src = makeSource("negate", "*.svg\n!public/logo.svg\n")
    const dest = join(root, "negate", "dest")
    await copyDir(src, dest)
    expect(existsSync(join(dest, "public", "icon.svg"))).toBe(false)
    expect(existsSync(join(dest, "public", "logo.svg"))).toBe(true)
  })
})
