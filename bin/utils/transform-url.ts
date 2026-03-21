import { getDefaultBranch } from "@/utils/get-default-branch"

type Host = "github.com" | "gitlab.com" | "bitbucket.org"

const PREFIXES: { prefix: string; host: Host }[] = [
  { prefix: "git@github.com:", host: "github.com" },
  { prefix: "https://github.com/", host: "github.com" },
  { prefix: "https://raw.githubusercontent.com/", host: "github.com" },
  { prefix: "git@gitlab.com:", host: "gitlab.com" },
  { prefix: "https://gitlab.com/", host: "gitlab.com" },
  { prefix: "git@bitbucket.org:", host: "bitbucket.org" },
  { prefix: "https://bitbucket.org/", host: "bitbucket.org" },
]

export async function configFromUrl(
  url: string,
  {
    branch,
    target,
  }: {
    branch?: string | null
    target?: string | null
  },
) {
  const tokenRegex = /^https:\/\/([^@]+)@(github\.com|gitlab\.com|bitbucket\.org)/
  const tokenMatch = url.match(tokenRegex)

  let token = ""
  if (tokenMatch) {
    token = tokenMatch[1]
    url = url.replace(`${tokenMatch[1]}@`, "")
  }

  let host: Host = "github.com"

  for (const { prefix, host: h } of PREFIXES) {
    if (url.startsWith(prefix)) {
      host = h
      url = url.replace(prefix, "")
      break
    }
  }

  const split = url.split("/")
  const owner = split[0]
  const repository = split[1]?.endsWith(".git") ? split[1].slice(0, -4) : split[1]

  const repoUrl = `https://${token ? token + "@" : token}${host}/${owner}/${repository}`

  let type: string
  let resolvedBranch: string
  let resolvedPath: string

  if (host === "github.com") {
    if (split[2] === "refs" && ["heads", "remotes", "tags"].includes(split[3])) {
      type = "raw"
      resolvedBranch = branch || split[4]
      resolvedPath = split.slice(5).join("/")
    } else if (split[2] === "blob") {
      type = "blob"
      resolvedBranch = branch || split[3]
      resolvedPath = split.slice(4).join("/")
    } else if (split[2] === "tree") {
      type = "tree"
      resolvedBranch = branch || split[3]
      resolvedPath = split.slice(4).join("/")
    } else if (split[2] === "commit") {
      type = "repository"
      resolvedBranch = branch || split[3]
      resolvedPath = ""
    } else {
      type = "repository"
      resolvedBranch = branch || (await getDefaultBranch(repoUrl))
      resolvedPath = ""
    }
  } else if (host === "gitlab.com") {
    if (split[2] === "-" && split[3] === "blob") {
      type = "blob"
      resolvedBranch = branch || split[4]
      resolvedPath = split.slice(5).join("/")
    } else if (split[2] === "-" && split[3] === "tree") {
      type = "tree"
      resolvedBranch = branch || split[4]
      resolvedPath = split.slice(5).join("/")
    } else {
      type = "repository"
      resolvedBranch = branch || (await getDefaultBranch(repoUrl))
      resolvedPath = ""
    }
  } else {
    // bitbucket.org — uses /src/branch/path for both files and dirs
    if (split[2] === "src") {
      type = "tree"
      resolvedBranch = branch || split[3]
      resolvedPath = split.slice(4).join("/")
    } else {
      type = "repository"
      resolvedBranch = branch || (await getDefaultBranch(repoUrl))
      resolvedPath = ""
    }
  }

  const resolvedTarget = target
    ? target
    : type === "blob"
      ? "."
      : resolvedPath.split("/").pop() || repository

  return {
    token,
    host,
    owner,
    repository,
    type,
    branch: resolvedBranch,
    path: resolvedPath,
    target: resolvedTarget,
  }
}
