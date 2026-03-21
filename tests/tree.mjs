import { readdirSync, statSync } from "node:fs"
import { join, basename } from "node:path"

function tree(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== ".git")
  entries.forEach((e, i) => {
    const last = i === entries.length - 1
    console.log(`${prefix}${last ? "└── " : "├── "}${e.name}`)
    if (e.isDirectory()) tree(join(dir, e.name), `${prefix}${last ? "    " : "│   "}`)
  })
}

const target = process.argv[2]
if (!target) process.exit(1)
const stat = statSync(target)
if (stat.isDirectory()) {
  console.log(target)
  tree(target)
} else {
  console.log(`${target} (file)`)
}
