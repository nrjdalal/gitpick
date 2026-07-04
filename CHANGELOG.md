# Changelog

## v6.1.1 (2026-07-04)

- Fix `bun install` failing with "fatal: not a git repository" when there's no `.git` (a zip download or a git-dependency install): the `prepare` hook now skips lefthook cleanly (`|| exit 0`) instead of failing the whole install.
- Make the CLI test suite pass on filesystems that can't create symlinks (e.g. a WSL `/mnt` DrvFs mount): it probes symlink support and skips only the symlink-specific assertions there, keeping full coverage everywhere else. (#70)

## v6.1.0 (2026-07-04)

- **Opt-in `--fast` transport** - fetch folder/repo picks by streaming the host archive (`.tar.gz`) and blob picks via a raw HTTP GET, instead of `git clone`. Typically 2-4x faster; enable per-pick with `--fast` or fleet-wide with `GITPICK_FAST=1`.
  - Default behavior is unchanged (`git clone`), so existing picks are byte-for-byte identical - the fast paths only run when opted in.
  - Zero-dependency streaming untar handles files, directories, symlinks, the executable bit, and pax long names; any miss (unknown host, non-2xx, unsupported entry, missing sub-path, mid-stream error, truncated archive, unsafe path) falls back to a clone.
  - Verified byte-identical to a clone across a 100-repo differential test; the only differences are archive semantics `git clone` does not apply (`.gitattributes` `export-ignore`/`export-subst`, Windows `core.autocrlf`, symlink-hostile Windows), all documented under "Fast Mode" in the README.

## v6.0.2 (2026-07-03)

- Add a dedicated `.gitpickignore` section to the README documenting the gitignore-style pattern syntax
- Document local-folder interactive mode and file preview, and note the `degit` binary alias
- Fix the bundle-size figure and tidy README grammar

## v6.0.1 (2026-07-03)

- Docs/`--help` polish: reword the `--auto-commit`/`--commit` descriptions to "Commit with ...", reorder the README features by relevance, and use plain hyphens (no em-dashes)

## v6.0.0 (2026-07-03)

- **Turn a clone into a git repo** - `--init`, `--auto-commit`, `--commit <msg>`
  - `--init` initializes the cloned output as a new git repository (idempotent; for a blob, inits the parent dir)
  - `--auto-commit` inits and commits with message `chore: gitpick'ed`
  - `--commit "<msg>"` inits and commits with your own message
  - staging is scoped to exactly what was cloned (the interactive paths stage the exact copied files), so unrelated contents of a pre-existing target are never swept into the commit
  - `git add --force` so a `.gitignore` that rode along in the clone can't abort staging; huge picks use a NUL pathspec file (with an argv fallback on git < 2.25)
  - refuses to initialize the current working directory; a failed init/commit is surfaced but never undoes the successful clone

## v5.5.1 (2026-07-03)

- **Slash-containing branch names** in `tree`/`blob` URLs now resolve correctly
  - `owner/repo/tree/feat/my-branch/src` picks branch `feat/my-branch` instead of failing with `Error: git checkout feat`
  - works across GitHub, GitLab, Bitbucket and Codeberg
  - the common single-segment pick stays network-free (only re-resolves against the ref list when the optimistic guess fails)
  - handles the tag-shadow case (a tag whose name prefixes a slash branch)

## v5.5.0 (2026-07-03)

- **`.gitpickignore`** - exclude paths from the copy with gitignore-style patterns
  - drop it at the root of the picked path; supports `*`, `**`, `?`, trailing `/` (dir-only), and `!` to re-include
  - the `.gitpickignore` file itself is never copied to the destination
- Overwrite existing symlinks instead of throwing `EEXIST` when re-picking into a populated directory

## v5.4.0 (2026-03-22)

- **Local directory interactive mode** - browse local directories with `gitpick -i`
  - `gitpick -i` browses cwd
  - `gitpick -i target` browses cwd, copies selected to target
  - `gitpick ./path -i target` browses a specific path
- Uses `git ls-files` to respect `.gitignore` when in a git repo
- Falls back to manual walk (skipping `.git` only) outside git repos
- Preserves symlinks when copying (uses `lstat` + `symlink`)
- Warns on symlink copy failures instead of swallowing silently
- Errors on target-inside-source and missing source with explicit target

## v5.3.0 (2026-03-22)

- **File preview** - press enter on a file to view its content with line numbers and cursor navigation
- **Syntax highlighting** - 38 languages via vendored `@speed-highlight/core` (zero runtime deps)
- File sizes shown right-aligned in tree view (files and folders)
- Full file path shown in preview header
- Enter on symlink-to-folder jumps cursor to target and expands ancestors
- Relative symlink paths resolved correctly for preview and selection
- Ctrl-C works in preview mode
- Terminal resize handled correctly in preview mode
- ANSI-aware line truncation prevents color bleed

## v5.2.0 (2026-03-22)

- Symlinks counted separately and shown in yellow in footer
- Selecting a symlink also selects its target file/folder
- Deselecting all children auto-deselects parent folder
- Press `.` toggles select all from anywhere
- Show "press . to select all" when nothing selected, "all selected" with size when everything selected
- Add interactive mode screenshot to README

## v5.1.0 (2026-03-22)

- Show symlinks in interactive picker (yellow with `->` target, matching dry-run tree)
- Show "all selected" status when everything is selected
- Scope interactive picker to subpath when using tree URLs (e.g. `owner/repo/tree/main/src -i`)
- Re-render interactive picker on terminal resize

## v5.0.0 (2026-03-22)

- **Interactive mode (`-i` / `--interactive`)** - browse any repo's file tree in your terminal and cherry-pick exactly the files and folders you want
  - Hierarchical tree view with expand/collapse, multi-select, select all
  - Keyboard navigation: arrow keys, `j`/`k`, `h`/`l`, space, enter, `c` to confirm, `q` to quit
  - Shows selection stats: folder/file count, total size, scroll position
  - Dark gray background highlight on current line, `●`/`○` selection indicators
  - Auto-expands all levels for small repos (<=30 entries), 2 levels for larger ones
  - Respects `--dry-run`, `--overwrite`, `--recursive`, `--tree`
  - Graceful TTY guard, SIGINT cleanup, alternate screen buffer
  - Works with GitHub, GitLab, Bitbucket, public and private repos
  - Zero new dependencies
- Add interactive mode tests (TTY guard, help text)
- Update README with interactive mode docs, table of contents, controls reference

## v4.19.0 (2026-03-22)

- **Environment variable token support** - `GITHUB_TOKEN`/`GH_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_TOKEN` auto-detected for private repos without embedding tokens in URLs
- **SIGINT/SIGTERM temp dir cleanup** - signal handlers clean up active temp directories on process kill
- **Non-TTY spinner suppression** - spinner animation completely suppressed in CI/piped output
- **`--verbose` now includes stats** - file count with size, network/copy/total time breakdown
- Non-blocking update notifier - checks npm registry in background, shows notice on next run

## v4.18.0 (2026-03-22)

- **Add `--quiet` / `-q` flag** - suppress all output except errors, ideal for CI pipelines and scripts
- **Add `--verbose` flag** - show detailed clone info: strategy (shallow/full), source URL, target path, file count, duration
- Update banner to two lines for readability
- Add `dim` color formatter
- Reorder README features list

## v4.17.0 (2026-03-22)

- **Add `--tree` flag** - display cloned file structure as a colored tree (like the `tree` command)
  - Bold cyan for root directory, cyan for subdirs, yellow for symlinks, cyan/white for symlink targets
  - Smart path header: `./` for cwd-relative, `~/` for home-relative, absolute otherwise
  - Works with `--dry-run` (clones to temp dir, prints tree, cleans up)
  - Consistent output for repos, folders, and blobs
- `copyDir` now returns list of copied file paths
- `cloneAction` returns `CloneResult` with files and duration
- Fix oxlint warnings in test suite
- Update package sizes in README

## v4.16.2 (2026-03-21)

- Add CLI help examples for `--dry-run`, GitLab and Bitbucket
- Update README with package sizes, multi-host config examples, and verified adopters

## v4.16.1 (2026-03-21)

- Add `--dry-run`, GitLab and Bitbucket examples to CLI help output
- Update README with package sizes and multi-host config examples

## v4.16.0 (2026-03-21)

- **Multi-host support** - clone from GitLab and Bitbucket in addition to GitHub
- Add `--dry-run` / `-n` flag to preview what would be cloned without cloning
- Add `/commit/` URL support - `owner/repo/commit/SHA` correctly extracts the commit SHA
- Add `refs/remotes` and `refs/tags` support for raw URLs (in addition to `refs/heads`)
- Preserve shorthand raw URL parsing (`owner/repo/refs/heads/branch/file`)
- Migrate test suite from bash scripts to bun:test (106 tests across dry-run, clone, config, integrity)
- Gate releases behind passing tests in CI
- Fix `pull_request.url` reference in release workflow

## v4.15.0 (2026-03-21)

- **34KB → 19KB (43% smaller), zero dependencies**
- Add `.gitpick.json` / `.gitpick.jsonc` config file support - pick multiple files, folders, branches in one command
- Internalize all external dependencies (terminal-link, yocto-spinner, yoctocolors, nano-spawn, strip-json-comments)
- Add symlink support in `copyDir`
- Fix Windows blob/tree path handling (split on both `/` and `\`, use `path.dirname`)
- Add cross-platform CI (ubuntu, macos, windows)
- Add PowerShell test suite for Windows backslash paths
- Migrate from prettier to oxfmt, simple-git-hooks to lefthook, add oxlint
- Move tests to `tests/` dir with cross-platform `tree.mjs` for file tree output

## v4.14.0 (2026-03-21)

- Add symlink support - `copyDir` now preserves symlinks instead of failing or following them
- Migrate from prettier to oxfmt/oxlint
- Migrate from simple-git-hooks to lefthook
- Clean up release workflow

## v4.13.0 (2026-03-21)

- Update build tooling dependencies
- Update package size in readme
- Add package runner support in test script

## v4.12.4 (2026-03-15)

- Update dependency @types/node to v25
- Update build tooling dependencies
- Fix typo in related projects section

## v4.12.3 (2025-10-22)

- Documentation updates

## v4.12.2 (2025-09-19)

- Fix Twitter badge link in README

## v4.12.1 (2025-09-19)

- Documentation and package.json updates

## v4.12.0 (2025-08-26)

- Update dependencies

## v4.11.0 - v4.11.3 (2025-05-07 - 2025-06-02)

- Dependency updates
- Documentation improvements

## v4.10.0 - v4.10.2 (2025-04-06 - 2025-04-30)

- Internal improvements
- Dependency updates

## v4.9.0 (2025-04-06)

- Update external dependencies
- Documentation improvements

## v4.8.0 - v4.8.1 (2025-04-04)

- CLI and documentation improvements

## v4.7.0 - v4.7.1 (2025-04-04)

- CLI improvements
- Clone action refinements

## v4.6.0 - v4.6.1 (2025-04-04)

- Refactor clone action, URL transform, and time parsing utilities
- CI workflow updates

## v4.5.0 - v4.5.3 (2025-04-03)

- External dependency management improvements
- CLI refinements

## v4.4.0 - v4.4.3 (2025-04-03)

- Clone action improvements

## v4.3.0 - v4.3.2 (2025-04-03)

- Extend commit clone capability
- External dependency updates

## v4.2.0 - v4.2.1 (2025-04-03)

- Major internal refactor
- Test infrastructure improvements

## v4.1.0 - v4.1.1 (2025-04-02)

- Dependency updates
- CI improvements

## v4.0.0 (2025-04-02)

- Major rewrite - new architecture with external vendored dependencies
- Zero runtime dependencies
- Faster cloning with shallow clone + sparse checkout
- Support for shorthands (`owner/repo`), full URLs, and SSH URLs
- Clone repos, trees, blobs, branches, commits, and raw content
- Watch mode (`--watch`) for continuous syncing
- Private repo support via PAT tokens
- Windows long path support

## v3.17.0 - v3.26.0 (2025-03-29 - 2025-03-30)

- Fix Win32 long paths support (#6)
- Logging improvements
- Switch from inquirer/ora to clack
- Add overwrite alias (`-o` for `--force`)
- Documentation updates
