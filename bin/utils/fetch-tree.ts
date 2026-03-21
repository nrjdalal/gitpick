import https from "node:https"

export type TreeEntry = {
  path: string
  type: "blob" | "tree"
  size?: number
}

function httpsGet(
  url: string,
  headers: Record<string, string>,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location
        if (location) {
          res.resume()
          return httpsGet(location, headers).then(resolve, reject)
        }
      }
      let body = ""
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers as Record<string, string>,
          body,
        }),
      )
    })
    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy()
      reject(new Error("Request timed out"))
    })
  })
}

async function fetchGitHub(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "gitpick",
  }
  if (token) headers.Authorization = `token ${token}`

  const res = await httpsGet(url, headers)

  if (res.statusCode === 401 || res.statusCode === 403) {
    throw new Error(
      `GitHub API returned ${res.statusCode}. For private repos or rate limits, set GITHUB_TOKEN or pass a token in the URL.`,
    )
  }
  if (res.statusCode !== 200) {
    throw new Error(`GitHub API returned ${res.statusCode}: ${res.body.slice(0, 200)}`)
  }

  const data = JSON.parse(res.body)
  return (data.tree || []).map((item: any) => ({
    path: item.path,
    type: item.type === "blob" ? "blob" : "tree",
    size: item.size,
  }))
}

async function fetchGitLab(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<TreeEntry[]> {
  const projectId = encodeURIComponent(`${owner}/${repo}`)
  const entries: TreeEntry[] = []
  let page = 1

  while (true) {
    const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`
    const headers: Record<string, string> = { "User-Agent": "gitpick" }
    if (token) headers["PRIVATE-TOKEN"] = token

    const res = await httpsGet(url, headers)

    if (res.statusCode === 401 || res.statusCode === 403) {
      throw new Error(
        `GitLab API returned ${res.statusCode}. For private repos, set GITLAB_TOKEN or pass a token in the URL.`,
      )
    }
    if (res.statusCode !== 200) {
      throw new Error(`GitLab API returned ${res.statusCode}: ${res.body.slice(0, 200)}`)
    }

    const items = JSON.parse(res.body)
    for (const item of items) {
      entries.push({
        path: item.path,
        type: item.type === "blob" ? "blob" : "tree",
      })
    }

    const nextPage = res.headers["x-next-page"]
    if (!nextPage || nextPage === "" || items.length === 0) break
    page = Number(nextPage)
  }

  return entries
}

async function fetchBitbucket(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = []
  let url: string | null =
    `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${encodeURIComponent(branch)}/?pagelen=100&max_depth=100`

  while (url) {
    const headers: Record<string, string> = { "User-Agent": "gitpick" }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await httpsGet(url, headers)

    if (res.statusCode === 401 || res.statusCode === 403) {
      throw new Error(
        `Bitbucket API returned ${res.statusCode}. For private repos, set BITBUCKET_TOKEN or pass a token in the URL.`,
      )
    }
    if (res.statusCode !== 200) {
      throw new Error(`Bitbucket API returned ${res.statusCode}: ${res.body.slice(0, 200)}`)
    }

    const data = JSON.parse(res.body)
    for (const item of data.values || []) {
      entries.push({
        path: item.path,
        type: item.type === "commit_directory" ? "tree" : "blob",
      })
    }

    url = data.next || null
  }

  return entries
}

export async function fetchRepoTree(config: {
  token: string
  host: string
  owner: string
  repository: string
  branch: string
}): Promise<TreeEntry[]> {
  if (config.host === "github.com") {
    return fetchGitHub(config.owner, config.repository, config.branch, config.token)
  }
  if (config.host === "gitlab.com") {
    return fetchGitLab(config.owner, config.repository, config.branch, config.token)
  }
  if (config.host === "bitbucket.org") {
    return fetchBitbucket(config.owner, config.repository, config.branch, config.token)
  }
  throw new Error(`Interactive mode is not supported for host: ${config.host}`)
}
