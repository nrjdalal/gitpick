import spawn from "nano-spawn"

export const getDefaultBranch = async (url: string) => {
  const remotes = (await spawn("git", ["ls-remote", url])).stdout
  const headHash = remotes.match(/(.+)\s+HEAD/)?.[1]
  const branch = remotes.match(
    new RegExp(`${headHash}\\s+refs/heads/(.+)`),
  )?.[1]
  if (!branch) {
    throw new Error("Could not determine default branch!")
  }
  return branch
}
