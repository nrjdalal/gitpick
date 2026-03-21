import { readdirSync, readlinkSync, statSync } from "node:fs"
import { join } from "node:path"

function tree(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== ".git")
  entries.forEach((e, i) => {
    const last = i === entries.length - 1
    const connector = last ? "└── " : "├── "
    if (e.isSymbolicLink()) {
      const target = readlinkSync(join(dir, e.name))
      console.log(`${prefix}${connector}${e.name} -> ${target}`)
    } else if (e.isDirectory()) {
      console.log(`${prefix}${connector}${e.name}`)
      tree(join(dir, e.name), `${prefix}${last ? "    " : "│   "}`)
    } else {
      console.log(`${prefix}${connector}${e.name}`)
    }
  })
}

const target = process.argv[2]
if (!target) process.exit(1)
const stat = statSync(target, { throwIfNoEntry: false })
if (stat?.isDirectory()) {
  console.log(target)
  tree(target)
} else {
  console.log(`${target} (file)`)
}
