import simpleGit from "simple-git"

export const getDefaultBranch = async (url: string) => {
  const remotes = await simpleGit().listRemote([url])
  const headHash = remotes.match(/(.+)\s+HEAD/)?.[1]
  const branch = remotes.match(
    new RegExp(`${headHash}\\s+refs/heads/(.+)`),
  )?.[1]
  if (!branch) {
    throw new Error("Could not determine default branch!")
  }
  return branch
}
