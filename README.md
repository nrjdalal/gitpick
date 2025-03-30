# GitPick

**Clone exactly what you need.**  
No more full-repo clones when all you want is a file or folder.

[![npm](https://img.shields.io/npm/v/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![downloads](https://img.shields.io/npm/dt/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![stars](https://img.shields.io/github/stars/nrjdalal/gitpick?color=blue)](https://github.com/nrjdalal/gitpick)

<img width="400" alt="GitPick Meme" src="https://github.com/user-attachments/assets/dde09ae9-1ee4-4cd8-a181-91f8e6ed6ba6" />

---

## ✨ Features

- 🔍 Clone individual files or folders from any GitHub repository
- ⚙️ Auto-detects branches and target directory (if not specified) like `git clone`
- 🔁 Sync changes remotely with `--watch` using intervals (e.g., `15s`, `1m`, `1h`)
- 🗑️ Overwrite existing files without prompt using `--overwrite`
- 🔐 Works with public & private repositories (via PAT)
- 🧠 Shorthand URLs supported (e.g. `TanStack/router`)

---

## 🚀 Quick Usage

```sh
npx gitpick <url/shorthand> [target] [options]
```

- [target] and [options] are optional

Examples:

```sh
npx gitpick https://github.com/TanStack/router      # repository without .git
npx gitpick TanStack/router/tree/main/examples      # a folder
npx gitpick TanStack/router/tree/main/package.json  # a file
npx gitpick <url/shorthand> -w 30s                  # sync every 30 seconds
npx gitpick <url/shorthand> -o                      # overwrite if exists
npx gitpick https://<token>@github.com/owner/repo   # private repo
```

---

## 🔧 Options

```txt
-b, --branch       Branch to clone from
-o, --overwrite    Skip overwrite prompt
-w, --watch [time] Auto-sync at intervals (default: 1m)
-h, --help         Show help
-v, --version      Show version
```

---

## 🔐 Private Repos

Use a [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#about-personal-access-tokens) (create one 👉 [here](https://github.com/settings/personal-access-tokens/new)) with `repo -> contents: read-only` permission:

```
npx gitpick https://<token>@github.com/owner/repo
```

---

## 📦 Install Globally (Optional)

```sh
npm install -g gitpick
gitpick <url/shorthand> [target] [options]
```

---

## 🛠 More Tools

Check out more projects at [github.com/nrjdalal](https://github.com/nrjdalal)

## 📄 License

MIT – [LICENSE](LICENSE)
