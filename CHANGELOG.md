# Changelog

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
