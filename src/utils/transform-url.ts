const regex =
  /^(?:(https:\/\/|git@)?github\.com[:\/])?([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/(blob|tree|refs\/heads))?(?:\/([^\/]+))?(?:\/(.+))?$/

const shouldMatch = [
  "user/repo",
  "user/repo/path/to/file",
  "user/repo/blob/branch/path/to/file",
  "user/repo/tree/branch/path/to/directory",
  "user/repo.git",
  "user/repo.git/path/to/file",
  "user/repo.git/blob/branch/path/to/file",
  "user/repo.git/tree/branch/path/to/directory",
  "https://github.com/user/repo",
  "https://github.com/user/repo/path/to/file",
  "https://github.com/user/repo/blob/branch/path/to/file",
  "https://github.com/user/repo/tree/branch/path/to/directory",
  "https://github.com/user/repo.git",
  "https://github.com/user/repo.git/path/to/file",
  "https://github.com/user/repo.git/blob/branch/path/to/file",
  "https://github.com/user/repo.git/tree/branch/path/to/directory",
  "git@github.com:user/repo",
  "git@github.com:user/repo/path/to/file",
  "git@github.com:user/repo/blob/branch/path/to/file",
  "git@github.com:user/repo/tree/branch/path/to/directory",
  "git@github.com:user/repo.git",
  "git@github.com:user/repo.git/path/to/file",
  "git@github.com:user/repo.git/blob/branch/path/to/file",
  "git@github.com:user/repo.git/tree/branch/path/to/directory",
  "https://raw.githubusercontent.com/user/repo/refs/heads/branch/file",
]

const parseGitHubUrl = (url) => {
  const match = url.match(regex)
  if (!match) {
    return null
  }

  const [_, prefix, user, repo, type, branch, path] = match

  return {
    user,
    repository: repo,
    type: type === "refs/heads" ? "raw" : type || (path ? false : null),
    branch: type && type !== "refs/heads" ? branch : path ? false : null,
    path: path ? path.slice(1) : type === "refs/heads" ? branch : null,
  }
}

shouldMatch.forEach((url) => {
  console.log(url, parseGitHubUrl(url))
})
