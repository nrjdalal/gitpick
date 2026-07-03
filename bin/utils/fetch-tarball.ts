import fs from "node:fs"
import { Readable } from "node:stream"

import { extractTarGz } from "@/external/untar"
import type { Host } from "@/utils/transform-url"

export type TarballConfig = {
  host: Host
  owner: string
  repository: string
  branch: string
}

const enc = (s: string) => s.split("/").map(encodeURIComponent).join("/")

// Per-host gzipped-archive URL for a ref (branch, tag, or commit SHA). Every
// host wraps the tree in a single top-level dir, so the caller strips one
// component. Returns null for an unknown host.
export const archiveUrl = (config: TarballConfig): string | null => {
  const { host, owner, repository, branch } = config
  const repo = `${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
  const ref = enc(branch)
  switch (host) {
    case "github.com":
      return `https://codeload.github.com/${repo}/tar.gz/${ref}`
    case "gitlab.com":
      return `https://gitlab.com/${repo}/-/archive/${ref}.tar.gz`
    case "bitbucket.org":
      return `https://bitbucket.org/${repo}/get/${ref}.tar.gz`
    case "codeberg.org":
      return `https://codeberg.org/${repo}/archive/${ref}.tar.gz`
    default:
      return null
  }
}

// Download the archive for a folder/repo pick and extract it into destDir
// (leaving it looking like the clone path's temp dir). Returns false on any miss
// - an unknown host, a non-2xx (a private repo, or a slash-branch the optimistic
// ref guess got wrong), or an entry the untar can't handle - so the caller falls
// back to the clone path. v1 sends no auth, so private repos 404 here and fall
// back, same seam as the raw fetch.
//
// Caveat: host archives honor .gitattributes `export-ignore` (omit paths) and
// `export-subst` (keyword expansion), which a clone does not. For the rare repo
// using those, a tarball pick reflects the archive - the same as degit/giget and
// any archive-based tool - rather than a full checkout.
export const fetchTarball = async (config: TarballConfig, destDir: string): Promise<boolean> => {
  const url = archiveUrl(config)
  if (!url) return false
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return false
  }
  if (!res.ok || !res.body) return false
  try {
    await fs.promises.mkdir(destDir, { recursive: true })
    await extractTarGz(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      destDir,
    )
  } catch {
    return false
  }
  return true
}
