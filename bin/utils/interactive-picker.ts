import { cyan, dim, green, yellow } from "@/external/yoctocolors"

export type TreeEntry = {
  path: string
  type: "blob" | "tree" | "symlink"
  size?: number
  linkTarget?: string
}

const stripAnsi = (s: string) => s.replace(/\x1B\[\d+(?:;\d+)*m/g, "")

type TreeNode = {
  name: string
  path: string
  type: "blob" | "tree" | "symlink"
  size: number
  linkTarget: string
  children: TreeNode[]
  expanded: boolean
  selected: boolean
  depth: number
}

function buildTree(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirs = new Map<string, TreeNode>()

  // Sort so directories come before files, then alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1
    return a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
  })

  for (const entry of sorted) {
    const parts = entry.path.split("/")
    const name = parts[parts.length - 1]
    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type,
      size: entry.size || 0,
      linkTarget: entry.linkTarget || "",
      children: [],
      expanded: false,
      selected: false,
      depth: parts.length - 1,
    }

    if (entry.type === "tree") {
      dirs.set(entry.path, node)
    }

    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join("/")
      const parent = dirs.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent directory wasn't in the tree entries - create implicit ones
        let currentPath = ""
        let currentList = root
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? currentPath + "/" + parts[i] : parts[i]
          let dir = dirs.get(currentPath)
          if (!dir) {
            dir = {
              name: parts[i],
              path: currentPath,
              type: "tree",
              size: 0,
              linkTarget: "",
              children: [],
              expanded: false,
              selected: false,
              depth: i,
            }
            dirs.set(currentPath, dir)
            currentList.push(dir)
          }
          currentList = dir.children
        }
        currentList.push(node)
      }
    }
  }

  // Sort children: dirs first, then files, alphabetically within each group
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    })
    for (const n of nodes) {
      if (n.children.length) sortChildren(n.children)
    }
  }
  sortChildren(root)

  return root
}

type FlatItem = {
  node: TreeNode
  prefix: string
  connector: string
}

function flatten(roots: TreeNode[]): FlatItem[] {
  const items: FlatItem[] = []

  function walk(nodes: TreeNode[], prefix: string) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const last = i === nodes.length - 1
      const connector = last ? "└── " : "├── "
      items.push({ node, prefix, connector })
      if (node.type === "tree" && node.expanded) {
        walk(node.children, prefix + (last ? "    " : "│   "))
      }
    }
  }

  walk(roots, "")
  return items
}

function setSelected(node: TreeNode, value: boolean) {
  node.selected = value
  for (const child of node.children) {
    setSelected(child, value)
  }
}

function collectSelected(nodes: TreeNode[]): string[] {
  const paths: string[] = []

  function walk(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.selected) {
        if (node.type === "tree") {
          // If a whole directory is selected, add the dir path
          // Only add the dir itself if ALL children are selected
          const allChildrenSelected =
            node.children.length > 0 && node.children.every((c) => c.selected)
          if (allChildrenSelected || node.children.length === 0) {
            paths.push(node.path)
          } else {
            walk(node.children)
          }
        } else {
          paths.push(node.path)
        }
      } else if (node.type === "tree") {
        // Dir not selected but maybe some children are
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return paths
}

function countSelected(nodes: TreeNode[]): { files: number; folders: number; size: number } {
  let files = 0
  let folders = 0
  let size = 0

  function walk(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.selected) {
        if (node.type === "tree") folders++
        else {
          files++
          size += node.size
        }
      }
      if (node.children.length) walk(node.children)
    }
  }

  walk(nodes)
  return { files, folders, size }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function interactivePicker(entries: TreeEntry[], label: string): Promise<string[]> {
  return new Promise((resolve) => {
    const tree = buildTree(entries)
    if (!tree.length) {
      resolve([])
      return
    }

    // Auto-expand: if ≤30 entries expand all, otherwise expand up to depth 1 (2 levels)
    function expandToDepth(nodes: TreeNode[], maxDepth: number, currentDepth = 0) {
      for (const node of nodes) {
        if (node.type === "tree" && currentDepth <= maxDepth) {
          node.expanded = true
          expandToDepth(node.children, maxDepth, currentDepth + 1)
        }
      }
    }

    if (entries.length <= 30) {
      expandToDepth(tree, Infinity)
    } else {
      expandToDepth(tree, 1)
    }

    let cursor = 0
    let scrollOffset = 0
    const stream = process.stdout
    const stdin = process.stdin

    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    // Enter alternate screen, hide cursor
    stream.write("\x1B[?1049h\x1B[?25l")

    function cleanup() {
      stdin.setRawMode(wasRaw ?? false)
      stdin.pause()
      stdin.removeListener("data", onKey)
      stream.removeListener("resize", onResize)
      // Exit alternate screen, show cursor
      stream.write("\x1B[?25h\x1B[?1049l")
    }

    // Safety net for clean terminal restore
    const onExit = () => {
      stream.write("\x1B[?25h\x1B[?1049l")
    }
    const onSigint = () => {
      cleanup()
      process.removeListener("exit", onExit)
      process.removeListener("SIGINT", onSigint)
      resolve([])
      process.exit(0)
    }
    const onResize = () => render()
    process.on("exit", onExit)
    process.on("SIGINT", onSigint)
    stream.on("resize", onResize)

    function render() {
      const rows = stream.rows || 24
      const cols = stream.columns || 80
      const headerLines = 3 // blank + label + blank
      const dotRowLines = 1
      const footerLines = 5
      const treeViewportHeight = Math.max(1, rows - headerLines - dotRowLines - footerLines)

      const items = flatten(tree)

      // Scroll only applies to tree items (cursor > 0)
      const treeCursor = cursor - 1 // -1 because 0 is dot row
      if (treeCursor >= 0) {
        if (treeCursor < scrollOffset) scrollOffset = treeCursor
        if (treeCursor >= scrollOffset + treeViewportHeight)
          scrollOffset = treeCursor - treeViewportHeight + 1
      } else {
        scrollOffset = 0
      }
      if (scrollOffset < 0) scrollOffset = 0

      const visible = items.slice(scrollOffset, scrollOffset + treeViewportHeight)
      const { files, folders, size } = countSelected(tree)

      // Build output
      let out = "\x1B[H\x1B[2J" // cursor home + clear screen

      // Header
      out += `\n  ${label}\n\n`

      // "." select-all row (virtual row at index 0, tree items shift by 1)
      const allSelected = tree.every((n) => n.selected)
      const dotCursor = cursor === 0
      const dotCheckbox = allSelected ? green("●") : dim("○")
      let dotLine = `${dotCursor ? yellow(">") : " "} ${dotCheckbox} ${dim(".")}`
      if (dotCursor) {
        const pad = Math.max(0, cols - stripAnsi(dotLine).length)
        dotLine = `\x1B[48;5;236m${dotLine}${" ".repeat(pad)}\x1B[49m`
      }
      out += dotLine + "\n"

      // Tree items
      for (let i = 0; i < visible.length; i++) {
        const item = visible[i]
        const idx = scrollOffset + i + 1 // +1 for the dot row
        const isCursor = idx === cursor
        const checkbox = item.node.selected ? green("●") : dim("○")
        const nameStr =
          item.node.type === "tree"
            ? cyan(item.node.name + "/")
            : item.node.type === "symlink"
              ? yellow(item.node.name) +
                dim(" -> ") +
                (item.node.linkTarget.endsWith("/")
                  ? cyan(item.node.linkTarget)
                  : item.node.linkTarget)
              : item.node.name
        const expandIcon =
          item.node.type === "tree" ? (item.node.expanded ? dim("▾ ") : dim("▸ ")) : "  "
        const pointer = isCursor ? yellow(">") : " "
        let line = `${pointer} ${checkbox} ${dim(item.prefix)}${dim(item.connector)}${expandIcon}${nameStr}`
        if (isCursor) {
          // Pad to full width, subtle dark gray background (ANSI 256 color 236)
          const pad = Math.max(0, cols - stripAnsi(line).length)
          line = `\x1B[48;5;236m${line}${" ".repeat(pad)}\x1B[49m`
        }
        out += line + "\n"
      }

      // Pad remaining viewport
      for (let i = visible.length; i < treeViewportHeight; i++) {
        out += "\n"
      }

      // Footer
      out += "\n"
      const scrollInfo =
        items.length > treeViewportHeight
          ? dim(
              ` • ${scrollOffset + 1}-${Math.min(scrollOffset + treeViewportHeight, items.length)}/${items.length}`,
            )
          : ""
      let statusLine: string
      if (allSelected) {
        statusLine = `  all selected${scrollInfo}`
      } else if (files + folders > 0) {
        const countParts: string[] = []
        if (folders > 0) countParts.push(cyan(`${folders} folder${folders !== 1 ? "s" : ""}`))
        if (files > 0) countParts.push(`${files} file${files !== 1 ? "s" : ""}`)
        const metaParts: string[] = [countParts.join(" "), dim(formatSize(size))]
        statusLine = `  ${metaParts.join(dim(" • "))}${scrollInfo}`
      } else {
        statusLine = dim("  nothing selected") + scrollInfo
      }
      out += statusLine + "\n"
      out += "\n"
      const instructions = dim("↑↓:navigate  enter:expand  space:select  c:confirm  q:quit")
      out += `  ${instructions}\n`

      stream.write(out)
    }

    function onKey(buf: Buffer) {
      const items = flatten(tree)
      const totalRows = items.length + 1 // +1 for dot row
      const key = buf.toString()

      // Ctrl-C or q → quit
      if (key === "\x03" || key === "q" || key === "Q") {
        cleanup()
        process.removeListener("exit", onExit)
        process.removeListener("SIGINT", onSigint)
        resolve([])
        return
      }

      // c → confirm
      if (key === "c" || key === "C") {
        cleanup()
        process.removeListener("exit", onExit)
        process.removeListener("SIGINT", onSigint)
        resolve(collectSelected(tree))
        return
      }

      // Arrow up
      if (key === "\x1B[A" || key === "k") {
        if (cursor > 0) cursor--
      }

      // Arrow down
      if (key === "\x1B[B" || key === "j") {
        if (cursor < totalRows - 1) cursor++
      }

      // Space or Enter on dot row → toggle select all
      if (cursor === 0 && (key === " " || key === "\r")) {
        const allSelected = tree.every((n) => n.selected)
        for (const node of tree) setSelected(node, !allSelected)
      }

      // Space → toggle selection (tree items)
      if (key === " " && cursor > 0) {
        const item = items[cursor - 1]
        if (item) {
          setSelected(item.node, !item.node.selected)
        }
      }

      // Enter → toggle expand/collapse directory (tree items)
      if (key === "\r" && cursor > 0) {
        const item = items[cursor - 1]
        if (item && item.node.type === "tree") {
          item.node.expanded = !item.node.expanded
        }
      }

      // Right arrow / l → expand directory
      if ((key === "\x1B[C" || key === "l") && cursor > 0) {
        const item = items[cursor - 1]
        if (item && item.node.type === "tree") {
          item.node.expanded = true
        }
      }

      // Left arrow / h → collapse directory
      if ((key === "\x1B[D" || key === "h") && cursor > 0) {
        const item = items[cursor - 1]
        if (item && item.node.type === "tree") {
          item.node.expanded = false
        }
      }

      render()
    }

    stdin.on("data", onKey)
    render()
  })
}
