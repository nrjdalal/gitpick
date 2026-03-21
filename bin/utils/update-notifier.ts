import fs from "node:fs"
import https from "node:https"
import os from "node:os"
import path from "node:path"

import { bold, cyan, dim, yellow } from "@/external/yoctocolors"

const CACHE_DIR = path.join(os.homedir(), ".cache", "gitpick")
const CACHE_FILE = path.join(CACHE_DIR, "update-check.json")
const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

type UpdateCache = {
  lastCheck: number
  latestVersion: string
}

function readCache(): UpdateCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"))
  } catch {
    return null
  }
}

function writeCache(cache: UpdateCache) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {}
}

function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      "https://registry.npmjs.org/gitpick/latest",
      { headers: { Accept: "application/json" }, timeout: 3000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return resolve(null)
        }
        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).version || null)
          } catch {
            resolve(null)
          }
        })
      },
    )
    req.on("error", () => resolve(null))
    req.on("timeout", () => {
      req.destroy()
      resolve(null)
    })
  })
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number)
  const c = current.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true
    if ((l[i] || 0) < (c[i] || 0)) return false
  }
  return false
}

/** Print update notice if a cached newer version is known. */
export function notifyUpdate(currentVersion: string, silent: boolean) {
  if (silent) return
  const cache = readCache()
  if (cache && isNewer(cache.latestVersion, currentVersion)) {
    console.log(
      dim(
        `\n  Update available: ${yellow(currentVersion)} → ${cyan(bold(cache.latestVersion))}` +
          `\n  Run ${cyan("npm i -g gitpick")} to update\n`,
      ),
    )
  }
}

/** Background check — fetch latest version and cache it. Does not block. */
export function scheduleUpdateCheck() {
  const cache = readCache()
  if (cache && Date.now() - cache.lastCheck < CHECK_INTERVAL) return

  setTimeout(async () => {
    const latest = await fetchLatestVersion()
    if (latest) {
      writeCache({ lastCheck: Date.now(), latestVersion: latest })
    }
  }, 0)
}
