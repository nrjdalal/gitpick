# Changelog

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

- **Environment variable token support** — `GITHUB_TOKEN`/`GH_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_TOKEN` auto-detected for private repos without embedding tokens in URLs
- **SIGINT/SIGTERM temp dir cleanup** — signal handlers clean up active temp directories on process kill
- **Non-TTY spinner suppression** — spinner animation completely suppressed in CI/piped output
- **`--verbose` now includes stats** — file count with size, network/copy/total time breakdown
- Non-blocking update notifier — checks npm registry in background, shows notice on next run

## v4.18.0 (2026-03-22)

- **Add `--quiet` / `-q` flag** — suppress all output except errors, ideal for CI pipelines and scripts
- **Add `--verbose` flag** — show detailed clone info: strategy (shallow/full), source URL, target path, file count, duration
- Update banner to two lines for readability
- Add `dim` color formatter
- Reorder README features list

## v4.17.0 (2026-03-22)

- **Add `--tree` flag** — display cloned file structure as a colored tree (like the `tree` command)
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

- **Multi-host support** — clone from GitLab and Bitbucket in addition to GitHub
- Add `--dry-run` / `-n` flag to preview what would be cloned without cloning
- Add `/commit/` URL support — `owner/repo/commit/SHA` correctly extracts the commit SHA
- Add `refs/remotes` and `refs/tags` support for raw URLs (in addition to `refs/heads`)
- Preserve shorthand raw URL parsing (`owner/repo/refs/heads/branch/file`)
- Migrate test suite from bash scripts to bun:test (106 tests across dry-run, clone, config, integrity)
- Gate releases behind passing tests in CI
- Fix `pull_request.url` reference in release workflow

## v4.15.0 (2026-03-21)

- **34KB → 19KB (43% smaller), zero dependencies**
- Add `.gitpick.json` / `.gitpick.jsonc` config file support — pick multiple files, folders, branches in one command
- Internalize all external dependencies (terminal-link, yocto-spinner, yoctocolors, nano-spawn, strip-json-comments)
- Add symlink support in `copyDir`
- Fix Windows blob/tree path handling (split on both `/` and `\`, use `path.dirname`)
- Add cross-platform CI (ubuntu, macos, windows)
- Add PowerShell test suite for Windows backslash paths
- Migrate from prettier to oxfmt, simple-git-hooks to lefthook, add oxlint
- Move tests to `tests/` dir with cross-platform `tree.mjs` for file tree output

## v4.14.0 (2026-03-21)

- Add symlink support — `copyDir` now preserves symlinks instead of failing or following them
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

## v4.11.0 – v4.11.3 (2025-05-07 – 2025-06-02)

- Dependency updates
- Documentation improvements

## v4.10.0 – v4.10.2 (2025-04-06 – 2025-04-30)

- Internal improvements
- Dependency updates

## v4.9.0 (2025-04-06)

- Update external dependencies
- Documentation improvements

## v4.8.0 – v4.8.1 (2025-04-04)

- CLI and documentation improvements

## v4.7.0 – v4.7.1 (2025-04-04)

- CLI improvements
- Clone action refinements

## v4.6.0 – v4.6.1 (2025-04-04)

- Refactor clone action, URL transform, and time parsing utilities
- CI workflow updates

## v4.5.0 – v4.5.3 (2025-04-03)

- External dependency management improvements
- CLI refinements

## v4.4.0 – v4.4.3 (2025-04-03)

- Clone action improvements

## v4.3.0 – v4.3.2 (2025-04-03)

- Extend commit clone capability
- External dependency updates

## v4.2.0 – v4.2.1 (2025-04-03)

- Major internal refactor
- Test infrastructure improvements

## v4.1.0 – v4.1.1 (2025-04-02)

- Dependency updates
- CI improvements

## v4.0.0 (2025-04-02)

- Major rewrite — new architecture with external vendored dependencies
- Zero runtime dependencies
- Faster cloning with shallow clone + sparse checkout
- Support for shorthands (`owner/repo`), full URLs, and SSH URLs
- Clone repos, trees, blobs, branches, commits, and raw content
- Watch mode (`--watch`) for continuous syncing
- Private repo support via PAT tokens
- Windows long path support

## v3.17.0 – v3.26.0 (2025-03-29 – 2025-03-30)

- Fix Win32 long paths support (#6)
- Logging improvements
- Switch from inquirer/ora to clack
- Add overwrite alias (`-o` for `--force`)
- Documentation updates
