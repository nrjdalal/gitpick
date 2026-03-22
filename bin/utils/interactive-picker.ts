import fs from "node:fs"
import path from "node:path"

import { bold, cyan, dim, green, yellow } from "@/external/yoctocolors"

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

  // Calculate folder sizes from children
  function calcSize(nodes: TreeNode[]): number {
    let total = 0
    for (const node of nodes) {
      if (node.children.length) {
        node.size = calcSize(node.children)
      }
      total += node.size
    }
    return total
  }
  calcSize(root)

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

function resolveSymlinkPath(symlinkPath: string, linkTarget: string): string {
  const symlinkDir = symlinkPath.includes("/") ? symlinkPath.split("/").slice(0, -1).join("/") : ""
  const rawTarget = linkTarget.replace(/\/$/, "")
  const resolved = symlinkDir ? `${symlinkDir}/${rawTarget}` : rawTarget
  const parts = resolved.split("/")
  const normalized: string[] = []
  for (const p of parts) {
    if (p === "..") normalized.pop()
    else if (p !== ".") normalized.push(p)
  }
  return normalized.join("/")
}

function findNodeByPath(roots: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of roots) {
    if (node.path === targetPath) return node
    if (node.children.length) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}

function updateParentSelection(roots: TreeNode[]) {
  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.children.length) {
        walk(node.children)
        node.selected = node.children.every((c) => c.selected)
      }
    }
  }
  walk(roots)
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

function countSelected(nodes: TreeNode[]): {
  files: number
  folders: number
  symlinks: number
  size: number
} {
  let files = 0
  let folders = 0
  let symlinks = 0
  let size = 0

  function walk(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.selected) {
        if (node.type === "tree") folders++
        else if (node.type === "symlink") symlinks++
        else {
          files++
          size += node.size
        }
      }
      if (node.children.length) walk(node.children)
    }
  }

  walk(nodes)
  return { files, folders, symlinks, size }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function interactivePicker(
  entries: TreeEntry[],
  label: string,
  basePath?: string,
): Promise<string[]> {
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
      const { files, folders, symlinks, size } = countSelected(tree)

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
        const leftPart = `${pointer} ${checkbox} ${dim(item.prefix)}${dim(item.connector)}${expandIcon}${nameStr}`
        const sizeLabel =
          item.node.size > 0 && item.node.type !== "symlink" ? dim(formatSize(item.node.size)) : ""
        const leftLen = stripAnsi(leftPart).length
        const sizeLen = stripAnsi(sizeLabel).length
        const gap = Math.max(1, cols - leftLen - sizeLen - 1)
        let line = sizeLabel ? `${leftPart}${" ".repeat(gap)}${sizeLabel} ` : leftPart
        if (isCursor) {
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
        statusLine = `  all selected ${dim("•")} ${dim(formatSize(size))}${scrollInfo}`
      } else if (files + folders + symlinks > 0) {
        const countParts: string[] = []
        if (folders > 0) countParts.push(cyan(`${folders} folder${folders !== 1 ? "s" : ""}`))
        if (files > 0) countParts.push(`${files} file${files !== 1 ? "s" : ""}`)
        if (symlinks > 0) countParts.push(yellow(`${symlinks} symlink${symlinks !== 1 ? "s" : ""}`))
        const metaParts: string[] = [countParts.join(" "), dim(formatSize(size))]
        statusLine = `  ${metaParts.join(dim(" • "))}${scrollInfo}`
      } else {
        statusLine = dim("  press . to select all") + scrollInfo
      }
      out += statusLine + "\n"
      out += "\n"
      const instructions = dim(
        basePath
          ? "↑↓:navigate  enter:expand/preview  space:select  c:confirm  q:quit"
          : "↑↓:navigate  enter:expand  space:select  c:confirm  q:quit",
      )
      out += `  ${instructions}\n`

      stream.write(out)
    }

    function showPreview(node: TreeNode) {
      const filePath = path.join(
        basePath!,
        node.type === "symlink" ? node.linkTarget.replace(/\/$/, "") : node.path,
      )
      let content: string
      try {
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          content = dim("(directory)")
        } else if (stat.size > 512 * 1024) {
          content = dim(`(file too large: ${formatSize(stat.size)})`)
        } else {
          const raw = fs.readFileSync(filePath)
          // Check if binary
          if (raw.includes(0)) {
            content = dim(`(binary file: ${formatSize(stat.size)})`)
          } else {
            content = raw.toString("utf-8")
          }
        }
      } catch {
        content = dim("(unable to read file)")
      }

      let previewCursor = 0
      let previewScrollOffset = 0
      const lines = content.split("\n")
      const lineNumWidth = String(lines.length).length

      function renderPreview() {
        const rows = stream.rows || 24
        const cols = stream.columns || 80
        const headerLines = 3
        const footerLines = 3
        const viewportHeight = Math.max(1, rows - headerLines - footerLines)

        // Adjust scroll to follow cursor
        if (previewCursor < previewScrollOffset) previewScrollOffset = previewCursor
        if (previewCursor >= previewScrollOffset + viewportHeight)
          previewScrollOffset = previewCursor - viewportHeight + 1
        if (previewScrollOffset < 0) previewScrollOffset = 0

        let out = "\x1B[H\x1B[2J"
        const pathStr =
          node.type === "symlink" ? yellow(node.path) + dim(" -> ") + node.linkTarget : node.path
        out += `\n  ${bold(pathStr)} ${dim("•")} ${dim(formatSize(node.size))}\n\n`

        const visibleCount = Math.min(viewportHeight, lines.length - previewScrollOffset)
        for (let i = 0; i < visibleCount; i++) {
          const lineIdx = previewScrollOffset + i
          const isCursorLine = lineIdx === previewCursor
          const lineNum = dim(`  ${String(lineIdx + 1).padStart(lineNumWidth)}  `)
          const lineContent = lines[lineIdx].slice(0, cols - lineNumWidth - 5)
          let line = `${lineNum}${lineContent}`
          if (isCursorLine) {
            const pad = Math.max(0, cols - stripAnsi(line).length)
            line = `\x1B[48;5;236m${line}${" ".repeat(pad)}\x1B[49m`
          }
          out += line + "\n"
        }

        // Pad remaining
        for (let i = visibleCount; i < viewportHeight; i++) {
          out += "\n"
        }

        out += "\n"
        const scrollInfo =
          lines.length > viewportHeight
            ? dim(
                `${previewScrollOffset + 1}-${Math.min(previewScrollOffset + viewportHeight, lines.length)}/${lines.length}`,
              ) + dim(" • ")
            : ""
        const previewInstructions = dim("↑↓:navigate  esc/q:back")
        out += `  ${scrollInfo}${previewInstructions}\n`

        stream.write(out)
      }

      function onPreviewKey(buf: Buffer) {
        const key = buf.toString()

        if (key === "\x1B" || key === "q" || key === "Q" || key === "\r") {
          stdin.removeListener("data", onPreviewKey)
          stdin.on("data", onKey)
          render()
          return
        }

        if (key === "\x1B[A" || key === "k") {
          if (previewCursor > 0) previewCursor--
        }
        if (key === "\x1B[B" || key === "j") {
          if (previewCursor < lines.length - 1) previewCursor++
        }

        renderPreview()
      }

      stdin.removeListener("data", onKey)
      stdin.on("data", onPreviewKey)
      renderPreview()
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

      // Space or Enter on dot row, or . anywhere → toggle select all
      if ((cursor === 0 && (key === " " || key === "\r")) || key === ".") {
        const allSelected = tree.every((n) => n.selected)
        for (const node of tree) setSelected(node, !allSelected)
      }

      // Space → toggle selection (tree items)
      if (key === " " && cursor > 0) {
        const item = items[cursor - 1]
        if (item) {
          const newValue = !item.node.selected
          setSelected(item.node, newValue)
          // If symlink selected, also select the target (but don't deselect it)
          if (newValue && item.node.type === "symlink" && item.node.linkTarget) {
            const targetPath = resolveSymlinkPath(item.node.path, item.node.linkTarget)
            const targetNode = findNodeByPath(tree, targetPath)
            if (targetNode) setSelected(targetNode, true)
          }
          updateParentSelection(tree)
        }
      }

      // Enter → expand/collapse directory, preview file, or jump to symlink target
      if (key === "\r" && cursor > 0) {
        const item = items[cursor - 1]
        if (item && item.node.type === "tree") {
          item.node.expanded = !item.node.expanded
        } else if (item && item.node.type === "symlink" && item.node.linkTarget.endsWith("/")) {
          // Symlink to folder - resolve relative path and jump to target
          const targetPath = resolveSymlinkPath(item.node.path, item.node.linkTarget)
          // Expand all ancestors so target is visible
          const pathParts = targetPath.split("/")
          for (let pi = 1; pi <= pathParts.length; pi++) {
            const ancestorPath = pathParts.slice(0, pi).join("/")
            const ancestor = findNodeByPath(tree, ancestorPath)
            if (ancestor && ancestor.type === "tree") ancestor.expanded = true
          }
          const targetNode = findNodeByPath(tree, targetPath)
          if (targetNode) {
            if (targetNode.type === "tree") targetNode.expanded = true
            const updatedItems = flatten(tree)
            const targetIdx = updatedItems.findIndex((fi) => fi.node === targetNode)
            if (targetIdx >= 0) cursor = targetIdx + 1 // +1 for dot row
          }
        } else if (
          item &&
          basePath &&
          (item.node.type === "blob" || item.node.type === "symlink")
        ) {
          showPreview(item.node)
          return
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
