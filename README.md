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
npx gitpick <url> [target] [options]
```

Examples:

```sh
npx gitpick TanStack/router                         # full repo
npx gitpick TanStack/router/tree/main/examples      # a folder
npx gitpick TanStack/router/tree/main/package.json  # a file
npx gitpick <url> -w 30s                            # sync every 30 seconds
npx gitpick <url> -o                                # overwrite without prompt
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

Use a [GitHub personal access token](https://github.com/settings/personal-access-tokens/new) with `repo -> contents: read-only` permission:

```
npx gitpick https://<token>@github.com/owner/repo
```

---

## 📦 Install Globally (Optional)

```sh
npm install -g gitpick
gitpick <url> [target] [options]
```

---

## 🛠 More Tools

Check out more projects at [github.com/nrjdalal](https://github.com/nrjdalal)

## 📄 License

MIT – [LICENSE](LICENSE)
