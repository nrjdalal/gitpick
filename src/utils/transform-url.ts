import { getDefaultBranch } from "./get-default-branch"

export async function githubConfigFromUrl(
  url: string,
  {
    branch,
    target,
  }: {
    branch?: string | null
    target?: string | null
  },
) {
  const prefixes = [
    "git@github.com:",
    "https://github.com/",
    "https://raw.githubusercontent.com/",
  ]

  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      url = url.replace(prefix, "")
      break
    }
  }

  const split = url.split("/")

  const owner = split[0]
  const repository = split[1].endsWith(".git")
    ? split[1].slice(0, -4)
    : split[1]
  const type =
    split[2] === "blob"
      ? "blob"
      : split[2] === "tree"
        ? "tree"
        : split[2] + split[3] === "refsheads"
          ? "raw"
          : "repository"
  const resolvedBranch = branch
    ? branch
    : type === "repository"
      ? await getDefaultBranch(`https://github.com/${owner}/${repository}`)
      : type === "raw"
        ? split[4]
        : split[3]
  const path = type
    ? type === "raw"
      ? split.slice(5).join("/")
      : split.slice(4).join("/")
    : split.slice(2).join("/") || "/"
  const resolvedTarget = target || path?.split("/").pop() || repository

  return {
    owner,
    repository,
    type,
    branch: resolvedBranch,
    path,
    target: resolvedTarget,
  }
}
