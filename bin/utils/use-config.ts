import fs from "node:fs"
import path from "node:path"

import spawn from "@/utils/spawn"
import stripJsonComments from "@/utils/strip-json-comments"

const configFiles = [".gitpick.json", ".gitpick.jsonc"]

export const useConfig = async () => {
  let configPath: string | undefined
  for (const file of configFiles) {
    const resolved = path.resolve(file)
    if (fs.existsSync(resolved)) {
      configPath = resolved
      break
    }
  }

  if (!configPath) return false

  const content = await fs.promises.readFile(configPath, "utf-8")
  const entries = JSON.parse(stripJsonComments(content))

  if (!Array.isArray(entries) || !entries.every((e: unknown) => typeof e === "string")) {
    throw new Error(`${path.basename(configPath)} must be an array of strings`)
  }

  for (const entry of entries) {
    await spawn(process.argv[0], [...process.argv.slice(1), ...entry.split(/\s+/), "-o"], {
      stdio: "inherit",
    })
  }

  return true
}
