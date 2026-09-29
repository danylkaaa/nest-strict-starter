---
name: commit-message
description: Write a commit message that passes this repo's commitlint rules. Use whenever creating a git commit, amending a message, or the user asks for a commit message.
---

# Commit Message

Messages are validated by the `commit-msg` hook using `commitlint.config.mjs` (Conventional Commits). A message that fails is rejected, so write it correctly the first time.

## Steps

1. Inspect what is staged: `git diff --staged --stat`, then `git diff --staged` if the stat is not enough. If nothing is staged, say so and stop; do not stage files unasked
2. Read `commitlint.config.mjs` for the current allowed scopes and limits; it is the source of truth over this file
3. Pick one `type`, an optional `scope`, and write the header
4. Add a body only when the _why_ is not obvious from the header
5. Commit with a heredoc so newlines survive, then confirm the hooks passed

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Rules

- **type**: one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **scope**: optional; if present it MUST be one of `api`, `repo`, `deps`, `tooling`, `docs`, `ci`. Omit the scope when a change spans several areas; never invent one
- **header**: at most 72 characters in total
- **subject**: imperative mood ("add", not "added"), all lower-case, no trailing period
- **body**: blank line after the header; wrap at 100 characters; explain why, not what
- **breaking change**: add `!` after the type or scope (`feat(api)!: ...`) and a `BREAKING CHANGE: <what and how to migrate>` footer
- **language**: English
- One logical change per commit; if the diff mixes unrelated changes, tell the user and suggest splitting
- Keep any `Co-Authored-By` trailer the environment requires as the last footer line

## Type Guide

| Change                              | Type                                |
| ----------------------------------- | ----------------------------------- |
| New user-visible behavior           | `feat`                              |
| Bug fix                             | `fix`                               |
| Restructure without behavior change | `refactor`                          |
| Tests only                          | `test`                              |
| Docs and agent rules only           | `docs`                              |
| Tooling, config, dependency bumps   | `chore` (scope `deps` or `tooling`) |
| Build system / CI pipeline          | `build` / `ci`                      |
| Formatting only                     | `style`                             |

## Examples

```
feat(api): add greeting endpoint
```

```
fix(api): reject empty name in greeting query

An empty string previously produced "Hello, !". Fall back to the default name instead.
```

```
chore(deps): bump oxlint to 1.86
```

## If the hook rejects the message

Read the `✖` lines, fix exactly those, and commit again with a new message. Never bypass with `--no-verify`.
