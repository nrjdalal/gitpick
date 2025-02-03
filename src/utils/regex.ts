export const regex = {
  branch: /^[a-zA-Z0-9.\-_]+$/,
  github: /^https:\/\/github\.com\/([^/]+)\/([^/]+)(\.git)?$/,
  githubPath:
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+?)(?<!\/)$/,
}
