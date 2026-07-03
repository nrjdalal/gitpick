import fs from "node:fs"
import path from "node:path"

type BlobConfig = {
  host: string
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
// v1 is a public-repo fast path: no auth header is sent, so a private repo (or
// any self-hosted host) simply 404s here and falls back to the clone path, which
// carries the token in the clone URL. Authenticated raw fetch is a follow-up.
export const fetchRawBlob = async (
  config: BlobConfig,
  targetPath: string,
): Promise<{ size: number; networkTime: number; copyTime: number } | null> => {
  if (typeof fetch !== "function") return null
  const url = rawBlobUrl(config)
  if (!url) return null

  const networkStart = performance.now()
  let bytes: Buffer
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    bytes = Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
  const networkTime = Number(((performance.now() - networkStart) / 1000).toFixed(2))

  const copyStart = performance.now()
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.promises.writeFile(targetPath, bytes)
  const copyTime = Number(((performance.now() - copyStart) / 1000).toFixed(2))

  return { size: bytes.length, networkTime, copyTime }
}
