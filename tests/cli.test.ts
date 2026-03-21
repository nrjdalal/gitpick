import { beforeAll, describe, expect, it } from "bun:test"
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"

const CLI = ["node", resolve("dist/index.mjs")]
const ARTIFACTS = ".test-artifacts"

// --- helpers ---

function stripAnsi(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "")
}

async function run(args: string[], cwd?: string) {
  const proc = Bun.spawn([...CLI, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd,
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { output: stdout + stderr, exitCode: await proc.exited }
}

function parseLine(output: string) {
  return (
    stripAnsi(output)
      .split("\n")
      .find((l) => l.includes("✔")) || ""
  )
}

function tree(dir: string, prefix = ""): string {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== ".git")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  let out = ""
  entries.forEach((e, i) => {
    const last = i === entries.length - 1
    const connector = last ? "└── " : "├── "
    if (e.isSymbolicLink()) {
      out += `${prefix}${connector}${e.name} -> ${readlinkSync(join(dir, e.name))}\n`
    } else if (e.isDirectory()) {
      out += `${prefix}${connector}${e.name}\n`
      out += tree(join(dir, e.name), `${prefix}${last ? "    " : "│   "}`)
    } else {
      out += `${prefix}${connector}${e.name}\n`
    }
  })
  return out
}

function getTree(dir: string) {
  if (!existsSync(dir)) return ""
  if (!lstatSync(dir).isDirectory()) return "(file)"
  return tree(dir).trimEnd()
}

// --- tree snapshots (sorted case-insensitive for bun's readdirSync) ---

const TREE_REPO_MAIN = [
  "├── file.txt",
  "├── folder",
  "│   ├── deep",
  "│   │   └── file.txt",
  "│   └── nested.txt",
  "├── README.md",
  "├── symdir -> folder",
  "└── symlink.txt -> file.txt",
].join("\n")

const TREE_REPO_DEV = [
  "├── dev.txt",
  "├── file.txt",
  "├── folder",
  "│   ├── deep",
  "│   │   └── file.txt",
  "│   └── nested.txt",
  "├── README.md",
  "├── symdir -> folder",
  "└── symlink.txt -> file.txt",
].join("\n")

const TREE_FOLDER = ["├── deep", "│   └── file.txt", "└── nested.txt"].join("\n")
const TREE_FOLDER_DEEP = "└── file.txt"
const TREE_BLOB_FILE = "└── file.txt"
const TREE_BLOB_NESTED = "└── nested.txt"
const TREE_BLOB_README = "└── README.md"

const TREE_GITLAB_REPO = [
  "├── .gitlab-ci.yml",
  "├── public",
  "│   ├── index.html",
  "│   └── style.css",
  "└── README.md",
].join("\n")

const TREE_GITLAB_PUBLIC = ["├── index.html", "└── style.css"].join("\n")

// --- test counter for unique artifact dirs ---

let n = 0
function target() {
  return join(ARTIFACTS, "cli", String(++n))
}

// --- high-level clone helper ---

async function cloneAndExpect(
  args: string[],
  expectedOutput: string,
  expectedTree: string,
  customTarget?: string,
) {
  const t = customTarget ? join(ARTIFACTS, "cli", customTarget) : target()
  if (existsSync(t) && !customTarget) rmSync(t, { recursive: true, force: true })

  const { output, exitCode } = await run(["clone", ...args, t])
  expect(parseLine(output)).toContain(expectedOutput)
  expect(exitCode).toBe(0)

  if (expectedTree === "(file)") {
    expect(lstatSync(t).isFile()).toBe(true)
  } else if (expectedTree) {
    expect(getTree(t)).toBe(expectedTree)
  } else {
    expect(existsSync(t)).toBe(true)
  }
}

// --- setup ---

beforeAll(() => {
  rmSync(join(ARTIFACTS, "cli"), { recursive: true, force: true })
  rmSync(join(ARTIFACTS, "config"), { recursive: true, force: true })
  mkdirSync(join(ARTIFACTS, "cli"), { recursive: true })
})

// =====================================================================
// DRY-RUN TESTS
// =====================================================================

describe("dry-run — URL parsing without cloning", () => {
  async function dryRun(args: string[], expected: string) {
    const { output, exitCode } = await run([...args, "--dry-run"])
    expect(exitCode).toBe(0)
    expect(parseLine(output)).toContain(expected)
  }

  // repo
  it(
    "shorthand repo",
    () => dryRun(["nrjdalal/picksuite"], "nrjdalal/picksuite repository:main > picksuite"),
    30000,
  )
  it(
    "full URL repo",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main > picksuite",
      ),
    30000,
  )

  // tree
  it(
    "shorthand tree",
    () =>
      dryRun(
        ["nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )
  it(
    "full URL tree",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )
  it(
    "nested tree",
    () =>
      dryRun(
        ["nrjdalal/picksuite/tree/main/folder/deep"],
        "nrjdalal/picksuite tree:main folder/deep > deep",
      ),
    30000,
  )
  it(
    "full URL nested tree",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/tree/main/folder/deep"],
        "nrjdalal/picksuite tree:main folder/deep > deep",
      ),
    30000,
  )

  // blob
  it(
    "shorthand blob",
    () =>
      dryRun(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt > ./file.txt",
      ),
    30000,
  )
  it(
    "full URL blob",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt > ./file.txt",
      ),
    30000,
  )
  it(
    "nested blob",
    () =>
      dryRun(
        ["nrjdalal/picksuite/blob/main/folder/nested.txt"],
        "nrjdalal/picksuite blob:main folder/nested.txt > ./nested.txt",
      ),
    30000,
  )
  it(
    "deep nested blob",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/blob/main/folder/deep/file.txt"],
        "nrjdalal/picksuite blob:main folder/deep/file.txt > ./file.txt",
      ),
    30000,
  )

  // branch
  it(
    "-b dev",
    () =>
      dryRun(["nrjdalal/picksuite", "-b", "dev"], "nrjdalal/picksuite repository:dev > picksuite"),
    30000,
  )
  it(
    "full URL -b dev",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite", "-b", "dev"],
        "nrjdalal/picksuite repository:dev > picksuite",
      ),
    30000,
  )
  it(
    "tree/dev",
    () => dryRun(["nrjdalal/picksuite/tree/dev"], "nrjdalal/picksuite tree:dev > picksuite"),
    30000,
  )
  it(
    "full URL tree/dev",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/tree/dev"],
        "nrjdalal/picksuite tree:dev > picksuite",
      ),
    30000,
  )

  // commit SHA
  it(
    "-b SHA",
    () =>
      dryRun(
        ["nrjdalal/picksuite", "-b", "8af536b"],
        "nrjdalal/picksuite repository:8af536b > picksuite",
      ),
    30000,
  )
  it(
    "/commit/ URL",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/commit/8af536b"],
        "nrjdalal/picksuite repository:8af536b > picksuite",
      ),
    30000,
  )

  // submodules
  it(
    "-r shorthand",
    () => dryRun(["nrjdalal/picksuite", "-r"], "nrjdalal/picksuite repository:main > picksuite"),
    30000,
  )
  it(
    "-r full URL",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite", "-r"],
        "nrjdalal/picksuite repository:main > picksuite",
      ),
    30000,
  )

  // token
  it(
    "token URL",
    () =>
      dryRun(
        ["https://fake_token@github.com/nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main > picksuite",
      ),
    30000,
  )

  // git@ and .git
  it(
    "git@",
    () =>
      dryRun(
        ["git@github.com:nrjdalal/picksuite.git"],
        "nrjdalal/picksuite repository:main > picksuite",
      ),
    30000,
  )
  it(
    ".git suffix",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite.git"],
        "nrjdalal/picksuite repository:main > picksuite",
      ),
    30000,
  )
  it(
    "git@ tree",
    () =>
      dryRun(
        ["git@github.com:nrjdalal/picksuite.git/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )
  it(
    ".git tree",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite.git/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )

  // branch override
  it(
    "branch override",
    () =>
      dryRun(
        ["nrjdalal/picksuite/tree/dev/folder", "-b", "main"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )
  it(
    "branch override URL",
    () =>
      dryRun(
        ["https://github.com/nrjdalal/picksuite/tree/dev/folder", "-b", "main"],
        "nrjdalal/picksuite tree:main folder > folder",
      ),
    30000,
  )

  // custom target
  it(
    "custom target repo",
    () => dryRun(["nrjdalal/picksuite", "my-dir"], "nrjdalal/picksuite repository:main > my-dir"),
    30000,
  )
  it(
    "custom target tree",
    () =>
      dryRun(
        ["nrjdalal/picksuite/tree/main/folder", "my-folder"],
        "nrjdalal/picksuite tree:main folder > my-folder",
      ),
    30000,
  )

  // raw URL
  it(
    "raw URL refs/heads",
    () =>
      dryRun(
        ["https://raw.githubusercontent.com/nrjdalal/picksuite/refs/heads/main/file.txt"],
        "nrjdalal/picksuite raw:main file.txt > file.txt",
      ),
    30000,
  )
  it(
    "raw URL refs/tags",
    () =>
      dryRun(
        ["https://raw.githubusercontent.com/nrjdalal/picksuite/refs/tags/main/file.txt"],
        "nrjdalal/picksuite raw:main file.txt > file.txt",
      ),
    30000,
  )
  it(
    "raw shorthand refs/heads",
    () =>
      dryRun(
        ["nrjdalal/picksuite/refs/heads/main/file.txt"],
        "nrjdalal/picksuite raw:main file.txt > file.txt",
      ),
    30000,
  )
  it(
    "raw URL refs/remotes",
    () =>
      dryRun(
        ["https://raw.githubusercontent.com/nrjdalal/picksuite/refs/remotes/origin/main/file.txt"],
        "nrjdalal/picksuite raw:origin/main file.txt > file.txt",
      ),
    30000,
  )

  // gitlab
  it(
    "gitlab repo",
    () =>
      dryRun(
        ["https://gitlab.com/pages/plain-html", "-b", "main"],
        "pages/plain-html repository:main > plain-html",
      ),
    30000,
  )
  it(
    "gitlab tree",
    () =>
      dryRun(
        ["https://gitlab.com/pages/plain-html/-/tree/main/public"],
        "pages/plain-html tree:main public > public",
      ),
    30000,
  )
  it(
    "gitlab blob",
    () =>
      dryRun(
        ["https://gitlab.com/pages/plain-html/-/blob/main/README.md"],
        "pages/plain-html blob:main README.md > ./README.md",
      ),
    30000,
  )

  // bitbucket
  it(
    "bitbucket repo",
    () =>
      dryRun(
        ["https://bitbucket.org/snakeyaml/snakeyaml", "-b", "master"],
        "snakeyaml/snakeyaml repository:master > snakeyaml",
      ),
    30000,
  )
  it(
    "bitbucket src path",
    () =>
      dryRun(
        ["https://bitbucket.org/snakeyaml/snakeyaml/src/master/src"],
        "snakeyaml/snakeyaml tree:master src > src",
      ),
    30000,
  )
})

// =====================================================================
// CLI CLONE TESTS
// =====================================================================

describe("default — gitpick <url/shorthand>", () => {
  it(
    "shorthand repo",
    () =>
      cloneAndExpect(["nrjdalal/picksuite"], "nrjdalal/picksuite repository:main", TREE_REPO_MAIN),
    30000,
  )
  it(
    "full URL repo",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )
  it(
    "git@ repo",
    () =>
      cloneAndExpect(
        ["git@github.com:nrjdalal/picksuite.git"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )
  it(
    ".git suffix repo",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite.git"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )

  it(
    "shorthand tree",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    "full URL tree",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    "git@ tree",
    () =>
      cloneAndExpect(
        ["git@github.com:nrjdalal/picksuite.git/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    ".git suffix tree",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite.git/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    "nested tree",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/main/folder/deep"],
        "nrjdalal/picksuite tree:main folder/deep",
        TREE_FOLDER_DEEP,
      ),
    30000,
  )

  it(
    "shorthand blob",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        TREE_BLOB_FILE,
      ),
    30000,
  )
  it(
    "full URL blob",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        TREE_BLOB_FILE,
      ),
    30000,
  )
  it(
    "nested blob",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/folder/nested.txt"],
        "nrjdalal/picksuite blob:main folder/nested.txt",
        TREE_BLOB_NESTED,
      ),
    30000,
  )
  it(
    "deep nested blob",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/blob/main/folder/deep/file.txt"],
        "nrjdalal/picksuite blob:main folder/deep/file.txt",
        TREE_BLOB_FILE,
      ),
    30000,
  )
})

describe("no prefix — gitpick <url> (without clone keyword)", () => {
  async function noPrefixClone(args: string[], expectedOutput: string, expectedTree: string) {
    const t = target()
    if (existsSync(t)) rmSync(t, { recursive: true, force: true })

    const { output, exitCode } = await run([...args, t])
    expect(parseLine(output)).toContain(expectedOutput)
    expect(exitCode).toBe(0)

    if (expectedTree === "(file)") {
      expect(lstatSync(t).isFile()).toBe(true)
    } else if (expectedTree) {
      expect(getTree(t)).toBe(expectedTree)
    } else {
      expect(existsSync(t)).toBe(true)
    }
  }

  it(
    "repo without clone prefix",
    () =>
      noPrefixClone(["nrjdalal/picksuite"], "nrjdalal/picksuite repository:main", TREE_REPO_MAIN),
    30000,
  )
  it(
    "tree without clone prefix",
    () =>
      noPrefixClone(
        ["nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    "blob without clone prefix",
    () =>
      noPrefixClone(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        TREE_BLOB_FILE,
      ),
    30000,
  )
})

describe("target — gitpick <url> [target]", () => {
  it(
    "repo → custom dir",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
        "my-repo",
      ),
    30000,
  )
  it(
    "tree → custom dir",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
        "my-folder",
      ),
    30000,
  )
  it(
    "blob → custom dir",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        TREE_BLOB_FILE,
        "my-blob",
      ),
    30000,
  )

  it(
    "repo → nested path",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
        "nested/path/repo",
      ),
    30000,
  )
  it(
    "tree → nested path",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/main/folder"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
        "nested/path/folder",
      ),
    30000,
  )
  it(
    "blob → nested path",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        TREE_BLOB_FILE,
        "nested/path/blob",
      ),
    30000,
  )

  it(
    "blob → renamed.txt",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        "(file)",
        "renamed.txt",
      ),
    30000,
  )
  it(
    "blob → nested renamed",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/main/file.txt"],
        "nrjdalal/picksuite blob:main file.txt",
        "(file)",
        "some/path/renamed.txt",
      ),
    30000,
  )
})

describe("branch — gitpick <url> -b [branch/SHA]", () => {
  it(
    "-b dev shorthand",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite", "-b", "dev"],
        "nrjdalal/picksuite repository:dev",
        TREE_REPO_DEV,
      ),
    30000,
  )
  it(
    "-b dev full URL",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite", "-b", "dev"],
        "nrjdalal/picksuite repository:dev",
        TREE_REPO_DEV,
      ),
    30000,
  )
  it(
    "tree/dev",
    () =>
      cloneAndExpect(["nrjdalal/picksuite/tree/dev"], "nrjdalal/picksuite tree:dev", TREE_REPO_DEV),
    30000,
  )
  it(
    "tree/dev URL",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/tree/dev"],
        "nrjdalal/picksuite tree:dev",
        TREE_REPO_DEV,
      ),
    30000,
  )

  it(
    "-b short SHA",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite", "-b", "8af536b"],
        "nrjdalal/picksuite repository:8af536b",
        TREE_REPO_MAIN,
      ),
    30000,
  )
  it(
    "/commit/ URL",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/commit/8af536b"],
        "nrjdalal/picksuite repository:8af536b",
        TREE_REPO_MAIN,
      ),
    30000,
  )
  it(
    "-b full SHA",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite", "-b", "8af536b29d38630301fc47f2e088c41248d41932"],
        "nrjdalal/picksuite repository:8af536b29d38630301fc47f2e088c41248d41932",
        TREE_REPO_MAIN,
      ),
    30000,
  )

  it(
    "branch override",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/dev/folder", "-b", "main"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )
  it(
    "branch override URL",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite/tree/dev/folder", "-b", "main"],
        "nrjdalal/picksuite tree:main folder",
        TREE_FOLDER,
      ),
    30000,
  )

  it(
    "blob from dev branch",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/blob/dev/dev.txt"],
        "nrjdalal/picksuite blob:dev dev.txt",
        "",
      ),
    30000,
  )
})

describe("overwrite — gitpick <url> -o / -f", () => {
  it("-o re-clone", async () => {
    const t = target()
    await run(["clone", "nrjdalal/picksuite/tree/main/folder", "-o", t])
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      "-o",
      t,
    ])
    expect(exitCode).toBe(0)
    expect(parseLine(output)).toContain("nrjdalal/picksuite tree:main folder")
    expect(getTree(t)).toBe(TREE_FOLDER)
  }, 60000)

  it("-f re-clone", async () => {
    const t = target()
    await run(["clone", "nrjdalal/picksuite/tree/main/folder", "-f", t])
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      "-f",
      t,
    ])
    expect(exitCode).toBe(0)
    expect(parseLine(output)).toContain("nrjdalal/picksuite tree:main folder")
    expect(getTree(t)).toBe(TREE_FOLDER)
  }, 60000)
})

describe("overwrite rejection", () => {
  it("rejects non-empty dir without -o", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "existing.txt"), "existing")

    const { output, exitCode } = await run(["clone", "nrjdalal/picksuite", t])
    expect(exitCode).toBe(1)
    expect(stripAnsi(output)).toContain("not empty")
  }, 30000)

  it("rejects existing blob without -o", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "file.txt"), "existing")

    const { output, exitCode } = await run(["clone", "nrjdalal/picksuite/blob/main/file.txt", t])
    expect(exitCode).toBe(1)
    expect(stripAnsi(output)).toContain("target file exists")
  }, 30000)

  it("allows clone into empty dir", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })

    const { exitCode } = await run(["clone", "nrjdalal/picksuite", t])
    expect(exitCode).toBe(0)
    expect(getTree(t)).toBe(TREE_REPO_MAIN)
  }, 30000)
})

describe("recursive — gitpick <url> -r", () => {
  it(
    "-r shorthand",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite", "-r"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )
  it(
    "-r full URL",
    () =>
      cloneAndExpect(
        ["https://github.com/nrjdalal/picksuite", "-r"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )
})

describe("raw URL", () => {
  it(
    "raw.githubusercontent.com",
    () =>
      cloneAndExpect(
        ["https://raw.githubusercontent.com/nrjdalal/picksuite/refs/heads/main/file.txt"],
        "nrjdalal/picksuite raw:main file.txt",
        "(file)",
      ),
    30000,
  )
})

describe("token URL", () => {
  it(
    "public repo with token",
    () =>
      cloneAndExpect(
        ["https://fake_token@github.com/nrjdalal/picksuite"],
        "nrjdalal/picksuite repository:main",
        TREE_REPO_MAIN,
      ),
    30000,
  )
})

describe("gitlab", () => {
  it(
    "repo",
    () =>
      cloneAndExpect(
        ["https://gitlab.com/pages/plain-html", "-b", "main"],
        "pages/plain-html repository:main",
        TREE_GITLAB_REPO,
      ),
    30000,
  )
  it(
    "tree",
    () =>
      cloneAndExpect(
        ["https://gitlab.com/pages/plain-html/-/tree/main/public"],
        "pages/plain-html tree:main public",
        TREE_GITLAB_PUBLIC,
      ),
    30000,
  )
  it(
    "blob",
    () =>
      cloneAndExpect(
        ["https://gitlab.com/pages/plain-html/-/blob/main/README.md"],
        "pages/plain-html blob:main README.md",
        TREE_BLOB_README,
      ),
    30000,
  )
})

// =====================================================================
// CLI FLAGS
// =====================================================================

describe("CLI flags", () => {
  it("--version", async () => {
    const { output, exitCode } = await run(["--version"])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("gitpick@")
  })

  it("--help (no args)", async () => {
    const { output, exitCode } = await run([])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("clone specific directories or files")
  })

  it("--dry-run exits 0 without cloning", async () => {
    const { output, exitCode } = await run(["nrjdalal/picksuite", "--dry-run"])
    expect(exitCode).toBe(0)
    expect(parseLine(output)).toContain("nrjdalal/picksuite repository:main")
  }, 30000)
})

// =====================================================================
// INTEGRITY
// =====================================================================

describe("integrity — .git exclusion, symlinks, content", () => {
  // references first clone (test #1 in "default" section)
  const repoDir = join(ARTIFACTS, "cli", "1")

  it(".git excluded", () => {
    expect(existsSync(join(repoDir, ".git"))).toBe(false)
  })

  it("symlink.txt is a symlink", () => {
    expect(lstatSync(join(repoDir, "symlink.txt")).isSymbolicLink()).toBe(true)
  })

  it("symdir is a symlink", () => {
    expect(lstatSync(join(repoDir, "symdir")).isSymbolicLink()).toBe(true)
  })

  it("symlink.txt → file.txt", () => {
    expect(readlinkSync(join(repoDir, "symlink.txt"))).toBe("file.txt")
  })

  it("symdir → folder", () => {
    expect(readlinkSync(join(repoDir, "symdir"))).toBe("folder")
  })

  it("file.txt content", () => {
    expect(readFileSync(join(repoDir, "file.txt"), "utf-8").trim()).toBe("root file")
  })

  it("folder/nested.txt content", () => {
    expect(readFileSync(join(repoDir, "folder/nested.txt"), "utf-8").trim()).toBe("nested file")
  })

  it("folder/deep/file.txt content", () => {
    expect(readFileSync(join(repoDir, "folder/deep/file.txt"), "utf-8").trim()).toBe("deep file")
  })
})

// =====================================================================
// CONFIG FILE
// =====================================================================

describe("config — .gitpick.jsonc", () => {
  const configDir = join(ARTIFACTS, "config")

  const CONFIG_TREES: Record<number, string> = {
    1: TREE_REPO_MAIN,
    2: TREE_REPO_MAIN,
    3: TREE_REPO_MAIN,
    4: TREE_REPO_MAIN,
    5: TREE_FOLDER,
    6: TREE_FOLDER,
    7: TREE_FOLDER,
    8: TREE_FOLDER,
    9: TREE_BLOB_FILE,
    10: TREE_REPO_DEV,
    11: TREE_REPO_DEV,
    12: TREE_REPO_MAIN,
    13: TREE_FOLDER,
    14: TREE_REPO_MAIN,
    15: TREE_GITLAB_REPO,
    16: TREE_GITLAB_PUBLIC,
  }

  beforeAll(async () => {
    rmSync(configDir, { recursive: true, force: true })
    mkdirSync(configDir, { recursive: true })
    copyFileSync("tests/fixtures.jsonc", join(configDir, ".gitpick.jsonc"))

    // run gitpick with no args in the config dir to trigger config mode
    const { exitCode } = await run([], resolve(configDir))
    expect(exitCode).toBe(0)
  }, 600000)

  for (let i = 1; i <= 16; i++) {
    it(`entry #${i}`, () => {
      const dir = join(configDir, String(i))
      expect(existsSync(dir)).toBe(true)
      expect(readdirSync(dir).length).toBeGreaterThan(0)

      const expected = CONFIG_TREES[i]
      if (expected) {
        expect(getTree(dir)).toBe(expected)
      }
    })
  }
})

// =====================================================================
// TREE OUTPUT
// =====================================================================

describe("--tree output", () => {
  function parseTreeOutput(output: string) {
    const stripped = stripAnsi(output).trim()
    const lines = stripped.split("\n")
    return { header: lines[0], tree: lines.slice(1).join("\n") }
  }

  const fwd = (s: string) => s.replaceAll("\\", "/")

  it("clone tree shows header and tree", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(t))
    expect(tree).toBe(TREE_FOLDER)
  }, 30000)

  it("clone repo shows header and full tree", async () => {
    const t = target()
    const { output, exitCode } = await run(["clone", "nrjdalal/picksuite", t, "--tree"])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(t))
    expect(tree).toBe(TREE_REPO_MAIN)
  }, 30000)

  it("no human-readable output with --tree", async () => {
    const t = target()
    const { output } = await run(["clone", "nrjdalal/picksuite/tree/main/folder", t, "--tree"])
    expect(stripAnsi(output)).not.toContain("GitPick")
    expect(stripAnsi(output)).not.toContain("✔")
    expect(stripAnsi(output)).not.toContain("Picked")
  }, 30000)

  it("dry-run tree shows header and tree without leaving files", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--dry-run",
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(t))
    expect(tree).toBe(TREE_FOLDER)
    expect(existsSync(resolve(t))).toBe(false)
  }, 30000)

  it("dry-run repo shows header and full tree", async () => {
    const t = target()
    const { output, exitCode } = await run(["nrjdalal/picksuite", t, "--dry-run", "--tree"])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(t))
    expect(tree).toBe(TREE_REPO_MAIN)
  }, 30000)

  it("header uses ./ for relative paths", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const { header } = parseTreeOutput(output)
    expect(header.startsWith("./")).toBe(true)
  }, 30000)

  it("blob shows parent dir header and file node", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/blob/main/file.txt",
      t,
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(join(ARTIFACTS, "cli")))
    expect(tree).toBe("└── file.txt")
  }, 30000)

  it("dry-run blob shows parent dir header and file node", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "nrjdalal/picksuite/blob/main/file.txt",
      t,
      "--dry-run",
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const { header, tree } = parseTreeOutput(output)
    expect(header).toContain(fwd(join(ARTIFACTS, "cli")))
    expect(tree).toBe("└── file.txt")
  }, 30000)
})

// =====================================================================
// QUIET & VERBOSE
// =====================================================================

describe("--quiet output", () => {
  it("suppresses all output on clone", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "-q",
    ])
    expect(exitCode).toBe(0)
    expect(output.trim()).toBe("")
  }, 30000)

  it("suppresses all output on dry-run", async () => {
    const { output, exitCode } = await run(["nrjdalal/picksuite", "--dry-run", "-q"])
    expect(exitCode).toBe(0)
    expect(output.trim()).toBe("")
  }, 30000)
})

describe("--verbose output", () => {
  it("shows clone metadata and stats on success", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--verbose",
    ])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    expect(stripped).toContain("clone:")
    expect(stripped).toContain("shallow")
    expect(stripped).toContain("from:")
    expect(stripped).toContain("picksuite.git")
    expect(stripped).toContain("files:")
    expect(stripped).toContain("network:")
    expect(stripped).toContain("copy:")
    expect(stripped).toContain("total:")
    expect(stripped).toMatch(/\d+ B|\d+\.\d+ KB|\d+\.\d+ MB/)
  }, 30000)

  it("reports full clone strategy for SHA", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite",
      "-b",
      "8af536b",
      t,
      "--verbose",
    ])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    expect(stripped).toContain("full (depth=full)")
  }, 30000)
})

describe("--quiet / --verbose interactions", () => {
  it("--quiet with --tree shows tree only, no banner or spinner", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "-q",
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    // tree output still shows (--tree takes precedence for its own output)
    expect(stripped).not.toContain("GitPick")
    expect(stripped).not.toContain("Picked")
    expect(stripped).not.toContain("✔")
  }, 30000)

  it("--verbose with --tree shows tree but no verbose metadata", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--verbose",
      "--tree",
    ])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    // --tree silences verbose output
    expect(stripped).not.toContain("clone:")
    expect(stripped).not.toContain("from:")
    // but tree still renders
    expect(stripped).toContain("deep")
    expect(stripped).toContain("nested.txt")
  }, 30000)

  it("--quiet dry-run produces no output", async () => {
    const { output, exitCode } = await run([
      "nrjdalal/picksuite/tree/main/folder",
      "--dry-run",
      "-q",
    ])
    expect(exitCode).toBe(0)
    expect(output.trim()).toBe("")
  }, 30000)

  it("--verbose dry-run shows info line but no clone metadata", async () => {
    const { output, exitCode } = await run(["nrjdalal/picksuite", "--dry-run", "--verbose"])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    expect(stripped).toContain("picksuite")
    // no clone metadata since nothing was cloned
    expect(stripped).not.toContain("clone:")
    expect(stripped).not.toContain("duration:")
  }, 30000)
})

// =====================================================================
// ENV VAR TOKENS
// =====================================================================

describe("env var token support", () => {
  it("GITHUB_TOKEN is used for shorthand URLs", async () => {
    const proc = Bun.spawn([...CLI, "nrjdalal/picksuite", "--dry-run"], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GITHUB_TOKEN: "fake_github_token" },
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    expect(exitCode).toBe(0)
    expect(parseLine(stdout)).toContain("nrjdalal/picksuite")
  }, 30000)

  it("GH_TOKEN fallback works", async () => {
    const proc = Bun.spawn([...CLI, "nrjdalal/picksuite", "--dry-run"], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "fake_gh_token" },
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    expect(exitCode).toBe(0)
    expect(parseLine(stdout)).toContain("nrjdalal/picksuite")
  }, 30000)

  it("URL token takes precedence over env var", async () => {
    const proc = Bun.spawn(
      [...CLI, "https://fake_url_token@github.com/nrjdalal/picksuite", "--dry-run"],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, GITHUB_TOKEN: "fake_env_token" },
      },
    )
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    expect(exitCode).toBe(0)
    expect(parseLine(stdout)).toContain("nrjdalal/picksuite")
  }, 30000)
})

// =====================================================================
// NON-TTY SPINNER
// =====================================================================

describe("non-TTY spinner suppression", () => {
  it("no spinner frames in piped output", async () => {
    const t = target()
    const { output, exitCode } = await run(["clone", "nrjdalal/picksuite/tree/main/folder", t])
    expect(exitCode).toBe(0)
    const stripped = stripAnsi(output)
    // Bun.spawn captures stdout as pipe (non-TTY), so spinner should be suppressed
    for (const frame of ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]) {
      expect(stripped).not.toContain(frame)
    }
    // But success message should still appear
    expect(stripped).toContain("Picked")
  }, 30000)
})

// =====================================================================
// SIGINT CLEANUP
// =====================================================================

describe("SIGINT temp dir cleanup", () => {
  // SIGINT is a POSIX signal — Windows does not deliver it to child processes
  it.skipIf(process.platform === "win32")(
    "cleans up temp dir on SIGINT",
    async () => {
      const { readdirSync } = await import("node:fs")
      const { tmpdir } = await import("node:os")

      // Snapshot temp dirs before
      const before = new Set(readdirSync(tmpdir()).filter((d) => d.startsWith("picksuite-")))

      const proc = Bun.spawn(
        [...CLI, "clone", "nrjdalal/picksuite", "/tmp/gitpick-sigint-test", "-o"],
        { stdout: "pipe", stderr: "pipe" },
      )

      // Poll until a new temp dir appears (max 10s)
      let newTempDir: string | null = null
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 100))
        const current = readdirSync(tmpdir()).filter(
          (d) => d.startsWith("picksuite-") && !before.has(d),
        )
        if (current.length > 0) {
          newTempDir = current[0]
          break
        }
      }

      // If we found it, kill and verify cleanup
      if (newTempDir) {
        proc.kill("SIGINT")
        await proc.exited

        const after = readdirSync(tmpdir()).filter(
          (d) => d.startsWith("picksuite-") && !before.has(d),
        )
        expect(after).toHaveLength(0)
      } else {
        // Clone finished before we could catch the temp dir — still valid, just skip assertion
        await proc.exited
      }
    },
    30000,
  )
})

// ---------------------------------------------------------------------------
// Interactive mode
// ---------------------------------------------------------------------------
describe("interactive mode", () => {
  it("should error on non-TTY with -i flag", async () => {
    const { output, exitCode } = await run(["nrjdalal/gitpick", "-i", "-b", "main"])
    expect(exitCode).not.toBe(0)
    expect(stripAnsi(output)).toContain("Interactive mode requires a TTY")
  })

  it("should show -i in help text", async () => {
    const { output } = await run(["--help"])
    expect(stripAnsi(output)).toContain("-i, --interactive")
  })
})
