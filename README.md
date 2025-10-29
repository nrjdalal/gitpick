# GitPick

<!--  -->

**Clone exactly what you need aka straightforward project scaffolding!**

📦 `Zero dependencies` / `Un/packed (<35/15kb)` / `Faster and more features` yet drop-in replacement for `degit`

[![Twitter](https://img.shields.io/twitter/follow/nrjdalal_dev?label=%40nrjdalal_dev)](https://twitter.com/nrjdalal_dev)
[![npm](https://img.shields.io/npm/v/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![downloads](https://img.shields.io/npm/dt/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![stars](https://img.shields.io/github/stars/nrjdalal/gitpick?color=blue)](https://github.com/nrjdalal/gitpick)

> #### Just `copy-and-paste` any GitHub URL - no editing required (shorthands work too) - to clone individual files, folders, branches, commits, raw content or even entire repositories without the `.git` directory.

Unlike other tools that force you to tweak URLs or follow strict formats to clone files, folders, branches or commits GitPick works seamlessly with any URL.

<img width="400" alt="GitPick Meme" src="https://github.com/user-attachments/assets/180c3e5b-320c-48d7-aaf9-a7402e74c882" />

---

## 📖 Some Examples

### See [Quick Usage](#-quick-usage) for to learn more.

```sh
# clone a repo without .git
npx gitpick owner/repo
npx gitpick https://github.com/owner/repo
# clone a folder aka tree
npx gitpick owner/repo/tree/main/path/to/folder
npx gitpick https://github.com/owner/repo/tree/main/path/to/folder
# clone a file aka blob
npx gitpick owner/repo/blob/main/path/to/file
npx gitpick https://github.com/owner/repo/blob/main/path/to/file
# clone a branch
npx gitpick owner/repo -b canary
npx gitpick https://github.com/owner/repo -b canary
npx gitpick owner/repo/tree/canary
npx gitpick https://github.com/owner/repo/tree/canary
# clone a commit SHA
npx gitpick owner/repo -b cc8e93
npx gitpick https://github.com/owner/repo/commit/cc8e93
# clone submodules
npx gitpick owner/repo -r
npx gitpick https://github.com/owner/repo -r
# clone a private repo
npx gitpick https://<token>@github.com/owner/repo
```

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
npx gitpick https://github.com/owner/repo          # repo without .git
npx gitpick owner/repo/tree/main/path/to/folder    # a folder aka tree
npx gitpick owner/repo/blob/main/path/to/file      # a file aka blob

npx gitpick <url/shorthand>                        # default git behavior
npx gitpick <url/shorthand> [target]               # with optional target
npx gitpick <url/shorthand> -b [branch/SHA]        # branch or commit SHA
npx gitpick <url/shorthand> -o                     # overwrite if exists
npx gitpick <url/shorthand> -r                     # clone submodules
npx gitpick <url/shorthand> -w 30s                 # sync every 30 seconds
npx gitpick https://<token>@github.com/owner/repo  # private repository
```

<img width="720" alt="Image" src="https://github.com/user-attachments/assets/ddbc41b4-bfc6-4287-bb85-eb949d723591" />

---

## 🔧 Options

```
-b, --branch       Branch/SHA to clone
-o, --overwrite    Skip overwrite prompt
-r, --recursive    Clone submodules
-w, --watch [time] Watch the repository and sync every [time]
                   (e.g. 1h, 30m, 15s)
-h, --help         display help for command
-v, --version      display the version number
```

---

## 🔐 Private Repos

Use a [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#about-personal-access-tokens) (create one 👉 [here](https://github.com/settings/personal-access-tokens/new)) with `repo -> contents: read-only` permission:

```sh
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

## 🔗 Related Projects

- [tiged](https://github.com/tiged/tiged) - community driven fork of degit
- [giget](https://github.com/unjs/giget) - alternative approach

[![Star History Chart](https://api.star-history.com/svg?repos=nrjdalal/gitpick,tiged/tiged,unjs/giget&type=timeline&logscale&legend=top-left)](https://www.star-history.com/#nrjdalal/gitpick&tiged/tiged&unjs/giget&type=timeline&logscale&legend=top-left)

## 🤝 Contributing

Contributions welcome — any help is appreciated!

- Fork the repo and create a branch (use descriptive names, e.g. feat/<name> or fix/<name>).
- Make your changes, add tests if applicable, and run the checks:
  - bun install
  - bun run sync:external
  - bun test
- Follow the existing code style and commit message conventions (use conventional commits: feat, fix, docs, chore).
- Open a PR describing the change, motivation, and any migration notes; link related issues.
- For breaking changes or large features, open an issue first to discuss the approach.
- By contributing you agree to the MIT license and the project's Code of Conduct.

Thank you for helping improve GitPick!

## 📄 License

MIT – [LICENSE](LICENSE)
