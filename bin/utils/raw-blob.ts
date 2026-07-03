import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

import { activeTempPaths } from "@/utils/cleanup"
import { elapsedSeconds } from "@/utils/elapsed"
import { tempName } from "@/utils/temp-name"
import type { Host } from "@/utils/transform-url"

// `host` is the canonical Host union (not a bare string) so the switch in
// rawBlobUrl is checked against the same host set transform-url parses - renaming
// or removing a host there surfaces here at author time.
export type BlobConfig = {
  host: Host
  owner: string
  repository: string
  branch: string
  path: string
}

// Encode each path segment but keep "/" as the separator so a ref or sub-path
// with spaces or reserved characters still forms a valid URL.
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/")

// The direct "raw file" URL for a single-file pick on each supported host. A
// successful GET returns the file bytes with no git clone. Returns null for an
// unknown host or an empty path so the caller keeps the clone path.
export const rawBlobUrl = (config: BlobConfig): string | null => {
  const { host, owner, repository, branch, path: filePath } = config
  if (!filePath) return null
  const repo = `${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
  const ref = encodePath(branch)
  const file = encodePath(filePath)
  switch (host) {
    case "github.com":
      return `https://raw.githubusercontent.com/${repo}/${ref}/${file}`
    case "gitlab.com":
      return `https://gitlab.com/${repo}/-/raw/${ref}/${file}`
    case "codeberg.org":
      // Gitea/Forgejo auto-resolves /raw/{ref}/ to the branch, tag, or commit
      // form via a 303 that fetch follows, so a tag or commit ref works too -
      // not just a branch.
      return `https://codeberg.org/${repo}/raw/${ref}/${file}`
    // bitbucket.org is intentionally absent: transform-url types every
    // bitbucket /src/ path (file or dir) as a tree, so a bitbucket single file
    // never reaches this fast path and uses the clone path instead. Add a case
    // here only once transform-url can tell a bitbucket file from a folder.
    default:
      return null
  }
}

// Try to satisfy a single-file (blob/raw) pick with one raw-endpoint GET instead
// of cloning the whole tree. Returns the written size and timings on success, or
// null on any miss so the caller falls back to the clone path.
//
// v1 is a public-repo fast path: no auth header is sent. A private or otherwise
// unresolvable file returns a non-2xx from every wired host (GitHub/Codeberg
// 404, GitLab 302->403), which `!res.ok` catches, falling back to the clone
// path (which carries the token in the clone URL). That fallback safety rests on
// each host in `rawBlobUrl` returning a non-2xx for a missing/forbidden raw
// request - confirm that before adding a host, since a host that answered with a
// 200 login/error page would write it verbatim. Authenticated raw fetch is a
// follow-up.
export const fetchRawBlob = async (
  config: BlobConfig,
  targetPath: string,
): Promise<{ size: number; networkTime: number; copyTime: number } | null> => {
  const url = rawBlobUrl(config)
  if (!url) return null

  const networkStart = performance.now()
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return null
  }
  // Fall back to the clone path on any non-2xx (see the invariant note above) or
  // a bodyless response. `fetch` resolves once the headers arrive, so this times
  // the connection/TTFB; the body transfer is measured below.
  if (!res.ok || !res.body) return null
  const networkTime = elapsedSeconds(networkStart)

  // Stream the body to a sibling temp file, then rename it onto the target: the
  // body is never fully buffered in memory, and a failed transfer never leaves a
  // partial file at the target (preserving the "miss -> fall back" contract). The
  // temp sits next to the target so the rename stays on one filesystem (atomic)
  // and replaces an existing target, so overwrites are atomic too. Its name is
  // collision-resistant (concurrent --watch ticks share a target) and it is
  // registered for signal cleanup so an interrupt mid-stream leaves nothing.
  const copyStart = performance.now()
  const tmpPath = `${targetPath}.${tempName("gitpick-")}.part`
  activeTempPaths.add(tmpPath)
  try {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
    await pipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      fs.createWriteStream(tmpPath),
    )
    await fs.promises.rename(tmpPath, targetPath)
  } catch {
    await fs.promises.rm(tmpPath, { force: true })
    return null
  } finally {
    activeTempPaths.delete(tmpPath)
  }
  const copyTime = elapsedSeconds(copyStart)

  const { size } = await fs.promises.stat(targetPath)
  return { size, networkTime, copyTime }
}
