# GitPick

With [gitpick](https://www.npmjs.com/package/gitpick), you can clone precisely what you need.

[![npm](https://img.shields.io/npm/v/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![npm](https://img.shields.io/npm/dt/gitpick?color=red&logo=npm)](https://www.npmjs.com/package/gitpick)
[![GitHub](https://img.shields.io/github/stars/nrjdalal/gitpick?color=blue)](https://github.com/nrjdalal/gitpick)

Tired of cloning an entire repository when you only need a specific file or folder?

Simply copy the Github URL and run with `npx gitpick <url> [target] [options]`, be that a public or a private repository.

- Target is optional, and follows default git clone behavior. Read [usage](#usage) for more details.

<img width="640" alt="Image" src="https://github.com/user-attachments/assets/7d7f281d-2268-4951-a785-7979c639140f" />

## Usage

```text
With gitpick, you can clone precisely what you need.

🚀 More awesome tools at https://github.com/nrjdalal

-------------------------------------
  gitpick <url> [target] [options]
-------------------------------------

Hint: Target is optional, and follows default git clone behavior.

Arguments:
  url                GitHub URL with path to file/folder
  target             Directory to clone into (optional)

Options:
  -b, --branch       Branch to clone
  -o, --overwrite    Skip overwrite prompt
  -w, --watch [time] Watch the repository and sync every [time]
                     (e.g. 1h, 30m, 15s) default: 1m
  -h, --help         display help for command
  -v, --version      display the version number

Examples:
  $ gitpick <url>
  $ gitpick <url> [target]
  $ gitpick <url> [target] -b [branch]
  $ gitpick <url> [target] -w [time]
  $ gitpick <url> [target] -b [branch] -w [time]
```

If you wish to clone a private repository, generate a [personal access token](https://github.com/settings/personal-access-tokens/new).

- For fine-grained access, select Repository permissions to be `Contents: Read-Only`.

- Use `https://<token>@github.com` as URL prefix when cloning.

Checkout https://github.com/nrjdalal for more awesome repositories.

## Installation

You can install GitPick globally using npm:

```sh
npm install -g gitpick
```

After installing, you can run the command:

```sh
gitpick <url> [target] [options]
```

Or use `npx` to run the command without installing:

```sh
npx gitpick <url> [target] [options]
```

## Usage

Run `npx gitpick <url> [target] [options]` to clone a file or directory from a GitHub repository.

---

Say your files are located at following GitHub URL with a directory:

> https://github.com/zce/velite/tree/main/docs

You can sync them to a target directory in your project using:

```bash
npx gitpick https://github.com/zce/velite/tree/main/docs awesome-docs
```

> This will clone the `docs` directory from the `zce/velite` repository to the `awesome-docs` directory in your project. If no target directory is given, it will use the last segment of the URL, e.g., in this case, `docs`.

---

If you need to watch for changes, just add `-w` or `-w [time]` (e.g., `1s`, `1m`, `1h` which is time in a human-readable format, default is `1m`):

```bash
gitpick https://github.com/zce/velite/tree/main/docs -w
```

---

Additionally, you can use this tool to clone any file or directory from any repository. For example:

```bash
gitpick https://github.com/nrjdalal/awesome-templates/tree/main/next.js-apps/next.js-pro
```

The above command will clone the `next.js-pro` template from that particular repository.

---

I would love feedback from you all. Let's go!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
