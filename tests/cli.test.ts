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
    // Give `--commit` a git identity so it works on a bare CI runner (which has
    // no global user.name/user.email). The missing-identity test spawns its own
    // process with these cleared, so it's unaffected.
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "gitpick test",
      GIT_AUTHOR_EMAIL: "test@gitpick.dev",
      GIT_COMMITTER_NAME: "gitpick test",
      GIT_COMMITTER_EMAIL: "test@gitpick.dev",
    },
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

// feat/nested slash branch = main + a distinctive root file
const TREE_REPO_NESTED = [
  "├── file.txt",
  "├── folder",
  "│   ├── deep",
  "│   │   └── file.txt",
  "│   └── nested.txt",
  "├── on-nested.txt",
  "├── README.md",
  "├── symdir -> folder",
  "└── symlink.txt -> file.txt",
].join("\n")

// `ignore` branch after `.gitpickignore` (folder/deep/ + *.md) is applied
const TREE_IGNORE = [
  "├── file.txt",
  "├── folder",
  "│   └── nested.txt",
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

  // codeberg
  it(
    "codeberg repo",
    () =>
      dryRun(
        ["https://codeberg.org/Codeberg/avatars", "-b", "main"],
        "Codeberg/avatars repository:main > avatars",
      ),
    30000,
  )
  it(
    "codeberg src/branch path",
    () =>
      dryRun(
        ["https://codeberg.org/Codeberg/avatars/src/branch/main/example"],
        "Codeberg/avatars tree:main example > example",
      ),
    30000,
  )
  it(
    "codeberg src/tag path",
    () =>
      dryRun(
        ["https://codeberg.org/Codeberg/avatars/src/tag/v1.0.0/example"],
        "Codeberg/avatars tree:v1.0.0 example > example",
      ),
    30000,
  )
  it(
    "codeberg src/commit path",
    () =>
      dryRun(
        [
          "https://codeberg.org/Codeberg/avatars/src/commit/c86887927797ce57a7e4666494903a4e9b1e901c/example",
        ],
        "Codeberg/avatars tree:c86887927797ce57a7e4666494903a4e9b1e901c example > example",
      ),
    30000,
  )
  it(
    "codeberg raw/branch file",
    () =>
      dryRun(
        ["https://codeberg.org/Codeberg/avatars/raw/branch/main/README.md"],
        "Codeberg/avatars blob:main README.md > ./README.md",
      ),
    30000,
  )
  it(
    "codeberg media/branch file",
    () =>
      dryRun(
        ["https://codeberg.org/Codeberg/avatars/media/branch/main/README.md"],
        "Codeberg/avatars blob:main README.md > ./README.md",
      ),
    30000,
  )
  it(
    "codeberg git@ repo",
    () =>
      dryRun(
        ["git@codeberg.org:Codeberg/avatars", "-b", "main"],
        "Codeberg/avatars repository:main > avatars",
      ),
    30000,
  )
  it(
    "codeberg git@ src path",
    () =>
      dryRun(
        ["git@codeberg.org:Codeberg/avatars/src/branch/main/example"],
        "Codeberg/avatars tree:main example > example",
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

describe("transport — single-file fast path", () => {
  async function strategy(args: string[]) {
    const t = target()
    if (existsSync(t)) rmSync(t, { recursive: true, force: true })
    const { output, exitCode } = await run(["clone", ...args, t, "--verbose", "-o"])
    expect(exitCode).toBe(0)
    return stripAnsi(output)
  }

  // A blob pick should be one raw-endpoint GET, not a whole-tree clone. If the
  // fast path silently broke, blobs would still work via the clone fallback and
  // the correctness tests above would stay green - this pins the fast path.
  it("blob pick uses a raw GET", async () => {
    expect(await strategy(["nrjdalal/picksuite/blob/main/file.txt"])).toContain("raw (single GET)")
  }, 30000)
  // A folder pick must not be routed through the raw path.
  it("tree pick still uses a shallow clone", async () => {
    expect(await strategy(["nrjdalal/picksuite/tree/main/folder"])).toContain("shallow (depth=1)")
  }, 30000)
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

  // A POSIX-absolute target for a blob must land at that absolute path, not at
  // a cwd-relative copy of it (the leading "/" used to be dropped on rebuild).
  it("blob → absolute target", async () => {
    const abs = resolve(ARTIFACTS, "cli", "abs-blob.txt")
    if (existsSync(abs)) rmSync(abs)
    const { exitCode } = await run(["clone", "nrjdalal/picksuite/blob/main/file.txt", abs, "-o"])
    expect(exitCode).toBe(0)
    expect(existsSync(abs)).toBe(true)
    expect(readFileSync(abs, "utf8").trim()).toBe("root file")
  }, 30000)
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

describe("slash branch — gitpick <url>/tree/<branch-with-slash>/<path>", () => {
  // picksuite has `feat/nested` but no `feat` branch, so a successful clone
  // proves the branch/path split was re-anchored against the real refs.
  it("resolves a slash branch and its sub-path", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/feat/nested/folder",
      t,
      "--verbose",
    ])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("@ feat/nested")
    expect(getTree(t)).toBe(TREE_FOLDER)
  }, 30000)
  it("resolves a slash branch with no sub-path (whole repo)", async () => {
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/feat/nested",
      t,
      "--verbose",
    ])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("@ feat/nested")
    expect(getTree(t)).toBe(TREE_REPO_NESTED)
  }, 30000)
  it("re-anchors when a tag shadows a longer branch", async () => {
    // picksuite has tag `release` AND branch `release/1.0`. `--branch release`
    // optimistically matches the tag, whose tree lacks `1.0/folder`; the missing
    // sub-path triggers a re-anchor to branch `release/1.0`.
    const t = target()
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/release/1.0/folder",
      t,
      "--verbose",
    ])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("@ release/1.0")
    expect(getTree(t)).toBe(TREE_FOLDER)
  }, 30000)
  it("does not hijack a real-branch sub-path miss into a shadowing tag", async () => {
    // branch `shadow` exists AND tag `shadow/extra` exists, but `extra` is not on
    // branch `shadow`. `--branch shadow` checks out the real branch (not detached),
    // so the missing sub-path must stay a clean not-found — never the tag's tree.
    const t = target()
    const { exitCode } = await run(["clone", "nrjdalal/picksuite/tree/shadow/extra", t])
    expect(exitCode).not.toBe(0)
    expect(getTree(t)).toBe("")
  }, 30000)
})

describe("tag — gitpick <url>/tree/<tag>", () => {
  it(
    "clones a tag ref",
    () =>
      cloneAndExpect(
        ["nrjdalal/picksuite/tree/v1.0"],
        "nrjdalal/picksuite tree:v1.0",
        TREE_REPO_MAIN,
      ),
    30000,
  )
})

describe("gitpickignore — source .gitpickignore excludes paths from the copy", () => {
  it("excludes matched paths and never copies .gitpickignore itself", async () => {
    const t = target()
    // picksuite `ignore` branch carries `.gitpickignore` (folder/deep/ + *.md)
    const { exitCode } = await run(["clone", "nrjdalal/picksuite/tree/ignore", t])
    expect(exitCode).toBe(0)
    expect(getTree(t)).toBe(TREE_IGNORE)
    expect(existsSync(join(t, ".gitpickignore"))).toBe(false)
  }, 30000)
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

// ---------------------------------------------------------------------------
// --init / --commit
// ---------------------------------------------------------------------------
describe("--init / --commit", () => {
  async function gitLog(cwd: string) {
    const proc = Bun.spawn(["git", "log", "--oneline"], { stdout: "pipe", cwd })
    return new Response(proc.stdout).text()
  }

  it("--help lists --init and --commit", async () => {
    const { output, exitCode } = await run(["--help"])
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("--init")
    expect(stripAnsi(output)).toContain("--commit")
  })

  it("--init initializes a git repo for a directory clone", async () => {
    const t = target()
    const { exitCode } = await run(["clone", "nrjdalal/picksuite/tree/main/folder", t, "--init"])
    expect(exitCode).toBe(0)
    expect(existsSync(join(t, ".git"))).toBe(true)
  }, 30000)

  it("--init initializes in the parent dir for a blob clone", async () => {
    const t = target()
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/blob/main/file.txt",
      join(t, "renamed.txt"),
      "--init",
    ])
    expect(exitCode).toBe(0)
    expect(existsSync(join(t, ".git"))).toBe(true)
  }, 30000)

  it("--commit creates the initial commit for a directory clone", async () => {
    const t = target()
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--commit",
      "Initial commit",
    ])
    expect(exitCode).toBe(0)
    expect(await gitLog(t)).toContain("Initial commit")
  }, 30000)

  it("--auto-commit implies --init and uses the default message", async () => {
    const t = target()
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--auto-commit",
    ])
    expect(exitCode).toBe(0)
    expect(existsSync(join(t, ".git"))).toBe(true)
    expect(await gitLog(t)).toContain("chore: gitpick'ed")
  }, 30000)

  it("a blob --commit stages ONLY the cloned file, not unrelated dir contents", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "unrelated.txt"), "should never be committed")
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/blob/main/file.txt",
      join(t, "file.txt"),
      "--commit",
      "add file",
    ])
    expect(exitCode).toBe(0)
    const proc = Bun.spawn(["git", "ls-files"], { stdout: "pipe", cwd: t })
    const tracked = await new Response(proc.stdout).text()
    expect(tracked).toContain("file.txt")
    expect(tracked).not.toContain("unrelated.txt")
  }, 30000)

  it("--init is idempotent when .git already exists", async () => {
    const t = target()
    mkdirSync(join(t, ".git"), { recursive: true })
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--init",
      "-o",
    ])
    expect(exitCode).toBe(0)
  }, 30000)

  it("an empty pick never falls back to `git add .` (pre-existing files stay untracked)", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "secret.env"), "SECRET")
    // the `ignore-all` branch carries `.gitpickignore` = `*`, so nothing is copied
    const { output, exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/ignore-all",
      t,
      "-o",
      "--commit",
      "scaffold",
    ])
    expect(exitCode).toBe(0)
    expect(existsSync(join(t, ".git"))).toBe(true) // init still ran
    expect(stripAnsi(output)).toContain("nothing was cloned") // explicit notice, not silent
    const proc = Bun.spawn(["git", "ls-files"], { stdout: "pipe", cwd: t })
    const tracked = (await new Response(proc.stdout).text()).trim()
    expect(tracked).toBe("") // nothing staged/committed — secret.env not swept in
  }, 30000)

  it("--commit surfaces git's real error when the commit fails (missing identity)", async () => {
    const t = target()
    const proc = Bun.spawn(
      [...CLI, "clone", "nrjdalal/picksuite/tree/main/folder", t, "--commit", "Init"],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "",
          GIT_AUTHOR_EMAIL: "",
          GIT_COMMITTER_NAME: "",
          GIT_COMMITTER_EMAIL: "",
        },
      },
    )
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    await proc.exited
    const out = stripAnsi(stdout + stderr)
    expect(out).toContain("Skipping commit")
    expect(out).toMatch(/ident/i) // git's own reason (e.g. "empty ident name"), not a hardcoded guess
  }, 30000)

  it("refuses to init the current working directory (directory clone into '.')", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "secret.env"), "SECRET")
    // clone a folder into the cwd itself — must NOT init/commit the cwd
    const { output, exitCode } = await run(
      ["clone", "nrjdalal/picksuite/tree/main/folder", ".", "--commit", "x", "-o"],
      t,
    )
    expect(exitCode).toBe(0)
    expect(stripAnsi(output)).toContain("Skipping git init")
    expect(existsSync(join(t, ".git"))).toBe(false)
  }, 30000)

  it("a directory --commit into a pre-existing dir does not stage unrelated files", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    writeFileSync(join(t, "secret.env"), "SECRET")
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "-o",
      "--commit",
      "scaffold",
    ])
    expect(exitCode).toBe(0)
    const proc = Bun.spawn(["git", "ls-files"], { stdout: "pipe", cwd: t })
    const tracked = await new Response(proc.stdout).text()
    expect(tracked).toContain("nested.txt")
    expect(tracked).not.toContain("secret.env")
  }, 30000)

  it("skip warnings are shown under --tree (only --quiet suppresses them)", async () => {
    const t = target()
    mkdirSync(t, { recursive: true })
    // clone into the cwd itself → cwd refusal, whose notice must still show under --tree
    const { output } = await run(
      ["clone", "nrjdalal/picksuite/tree/main/folder", ".", "--init", "-o", "--tree"],
      t,
    )
    expect(stripAnsi(output)).toContain("Skipping git init")
  }, 30000)

  it("commits cloned files even when a cloned .gitignore matches them", async () => {
    const t = target()
    // the `gitignored` branch ships `.gitignore` = *.log plus a tracked debug.log
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/gitignored",
      t,
      "--commit",
      "add",
    ])
    expect(exitCode).toBe(0)
    const proc = Bun.spawn(["git", "ls-files"], { stdout: "pipe", cwd: t })
    const tracked = await new Response(proc.stdout).text()
    expect(tracked).toContain("debug.log") // force-added, not aborted by .gitignore
    expect(await gitLog(t)).toContain("add")
  }, 30000)

  it("--commit with an empty message falls back to the default", async () => {
    const t = target()
    const { exitCode } = await run([
      "clone",
      "nrjdalal/picksuite/tree/main/folder",
      t,
      "--commit",
      "",
    ])
    expect(exitCode).toBe(0)
    expect(await gitLog(t)).toContain("chore: gitpick'ed")
  }, 30000)
})
