# GitPick

**Clone exactly what you need aka straightforward project scaffolding!**

📦 `Zero dependencies` / `Un/packed (<30/15kb)` / `Faster and more features` yet drop-in replacement for `degit`

[![Twitter](https://img.shields.io/twitter/follow/nrjdalal_com?label=%40nrjdalal_com)](https://twitter.com/nrjdalal_com)
[![npm](https://img.shields.io/npm/v/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![downloads](https://img.shields.io/npm/dt/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![stars](https://img.shields.io/github/stars/nrjdalal/gitpick?color=blue)](https://github.com/nrjdalal/gitpick)

<img width="400" alt="GitPick Meme" src="https://github.com/user-attachments/assets/180c3e5b-320c-48d7-aaf9-a7402e74c882" />

---

## ✨ Features

- 🔍 Clone individual files or folders from any GitHub repository
- ⚙️ Auto-detects branches and target directory (if not specified) like `git clone`
- 🧠 Use shorthands `TanStack/router` or full URL's `https://github.com/TanStack/router`
- 🗑️ Overwrite or replace existing files without a prompt using `-o` | `--overwrite`
- 📦 Can easily clone all submodules with `-r` | `--recursive`
- 🔁 Sync changes remotely with `--watch` using intervals (e.g., `15s`, `1m`, `1h`)
- 🔐 Seamlessly works with both public and private repositories using a PAT

---

## 🚀 Quick Usage

```sh
npx gitpick <url/shorthand> [target] [options]
```

- [target] and [options] are optional, if not specified, GitPick fallbacks to the default behavior of `git clone`

Examples:

```sh
npx gitpick https://github.com/TanStack/router      # repo without .git
npx gitpick TanStack/router/tree/main/examples      # a folder
npx gitpick TanStack/router/tree/main/package.json  # a file

npx gitpick <url/shorthand>                         # default git behavior
npx gitpick <url/shorthand> [target]                # with optional target
npx gitpick <url/shorthand> -b [branch]             # a branch
npx gitpick <url/shorthand> -o                      # overwrite if exists
npx gitpick <url/shorthand> -r                      # clone submodules
npx gitpick <url/shorthand> -w 30s                  # sync every 30 seconds
npx gitpick https://<token>@github.com/owner/repo   # private repo
```

<img width="720" alt="Image" src="https://github.com/user-attachments/assets/ddbc41b4-bfc6-4287-bb85-eb949d723591" />

---

## 🔧 Options

```txt
-b, --branch       Branch to clone from
-o, --overwrite    Skip overwrite prompt
-r, --recursive    Clone submodules
-w, --watch [time] Sync at intervals
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
