import { readdirSync } from "node:fs"
import { join } from "node:path"

function tree(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== ".git")
  entries.forEach((e, i) => {
    const last = i === entries.length - 1
    console.log(`${prefix}${last ? "└── " : "├── "}${e.name}`)
    if (e.isDirectory()) tree(join(dir, e.name), `${prefix}${last ? "    " : "│   "}`)
  })
}

const dir = process.argv[2]
if (!dir) process.exit(1)
console.log(dir)
tree(dir)
