# AGENTS.md

Working guidelines for agents (and humans) contributing to **GitPick**. `CLAUDE.md` is a symlink to this file, so Claude Code and other agents read the same rules. When we establish a new convention, add it here.

## What GitPick is

A CLI to clone specific files, folders, branches, commits, or whole repos from GitHub, GitLab, Bitbucket, and Codeberg. Entry point `bin/index.ts`; bundled to `dist/index.mjs` with `tsdown`.

## Testing — use picksuite, not third-party repos

The end-to-end CLI tests (`tests/cli.test.ts`) drive **real clones** against **[nrjdalal/picksuite](https://github.com/nrjdalal/picksuite)**, our own fixture repo.

- Add new fixtures (branches, tags, files) to **picksuite** — not to other people's repos.
- Put fixtures on **dedicated branches/tags**; keep `main` stable because its tree snapshots back many tests.
- Current fixtures: branches `main`, `dev`, `feat/nested`, `ignore` (carries `.gitpickignore`), `release/1.0`, `shadow`; tags `v1.0`, `release`, `shadow/extra`; commit `8af536b`.
- Cross-host tests (GitLab/Bitbucket/Codeberg) necessarily use third-party repos (`pages/plain-html`, `snakeyaml/snakeyaml`, `Codeberg/avatars`) since picksuite is GitHub-only. Only reach for a third-party repo when picksuite genuinely can't cover the case.

Run the whole suite (build + tests):

```bash
bun run test
```

**Filesystem note (WSL/Windows):** picksuite's `main` carries two symlinks (`symlink.txt`, `symdir`) that back the whole-repo tree snapshots. The suite writes its artifacts under `os.tmpdir()` (`/tmp`, ext4 on WSL) rather than the checkout directory, so symlinks work and the tests pass even when the repo is cloned on a `/mnt/*` Windows-drive mount (DrvFs). No special setup needed - run `bun run test` from anywhere.

## Performance — always benchmark with hyperfine

Any change touching a hot or clone-path code path must be benchmarked with **`hyperfine`** before finalizing. Reasoning about the overhead is not enough — measure it.

- Build the changed version and `main` as separate bundles and compare them.
- Isolate a **CPU-only path** (`--dry-run` on a tree URL — no network) from the **network path**, so real code overhead isn't buried under network noise.
- Report `mean ± σ` for both; there must be no regression.

```bash
hyperfine --warmup 3 --runs 25 -N \
  -n main "node main.mjs nrjdalal/picksuite/tree/main/folder --dry-run -q" \
  -n new  "node new.mjs  nrjdalal/picksuite/tree/main/folder --dry-run -q"
```

## Clone design principle

Keep the common single-segment pick **network-free**. Guess optimistically (first URL segment = branch) and only reach for extra network work (`ls-remote`, full clone) on the failure or genuinely-ambiguous path — never add an up-front round-trip to the happy path. See `bin/utils/resolve-ref.ts`.

## Code style & commits

- Formatting: `oxfmt` (`bun run format` / `format:check`). Linting: `oxlint`.
- Commits: **Conventional Commits** (enforced by commitlint). `lefthook` runs oxfmt + oxlint on staged files and commitlint on the message at commit time.
- **Never co-author commits** - no `Co-Authored-By` trailers and no "Generated with" lines in commit messages or PR bodies.
- Order imports alphabetically by path.

## Layout

- `bin/index.ts` — CLI entry: arg parsing, interactive (`-i`) and config-file modes.
- `bin/utils/transform-url.ts` — parse any host URL into a config (`branch`, `path`, `refSegments`, …).
- `bin/utils/clone-action.ts` — clone + copy for the default single-pick path.
- `bin/utils/resolve-ref.ts` — slash-branch / tag-shadow ref resolution.
- `bin/utils/copy-dir.ts` — recursive copy that honors `.gitpickignore`.
