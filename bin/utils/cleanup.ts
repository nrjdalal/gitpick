import fs from "node:fs"

import { activeChildren } from "@/external/nano-spawn"

// Temp paths (dirs from the clone path, `.part` files from the raw fetch) to
// remove if the process is interrupted mid-pick. Shared so both paths register
// with the same signal handler.
export const activeTempPaths = new Set<string>()

function cleanupAndExit() {
  // Kill any running git child first so it stops writing into a temp dir;
  // otherwise a child signalled on its own (not via the process group) is
  // orphaned and re-creates the dir we are about to remove.
  for (const child of activeChildren) {
    try {
      child.kill("SIGKILL")
    } catch {}
  }
  for (const p of activeTempPaths) {
    try {
      fs.rmSync(p, { recursive: true, force: true })
    } catch {}
  }
  process.exit(1)
}

process.on("SIGINT", cleanupAndExit)
process.on("SIGTERM", cleanupAndExit)
