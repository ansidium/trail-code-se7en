---
title: "Upstream sync: front-matter port, and global git installs break"
author: ansidium
date: 2026-10-22
branch: learn/upstream-sync-20261022
id: l-4cf19e14
scope: repo
status: active
touches:
  - src/util/front-matter.ts
  - src/util/frontmatter.ts
  - src/cli-meta.ts
  - scripts/run-tests.mjs
  - test/cards.test.ts
  - package-lock.json
---

## Decided
- Sync recipe (2026-10-22, upstream 22aa846 → fork 0.23.3): merge `upstream/main` into a branch, resolve, `npm install`, full `npm test`, then fast-forward `main` and push. Version bump goes in package.json and the lock root.
- `src/util/front-matter.ts` conflicts on every upstream change there: upstream builds on gray-matter, the fork on its own js-yaml adapter (`src/util/frontmatter.ts`). Keep the adapter and port upstream's API on top. Anchor/alias refusal goes through the adapter's `listener` option (js-yaml 4.3.2 keeps anchors in `state.anchorMap`, which the proxy swaps out on the first `open` event); refused files are rebuilt from `unread()`, not from a second parse.
- `package-lock.json`: take upstream's lock (`git checkout --theirs`), then `npm install` and `npm update undici` (upstream pins 6.28.0, the fork wants ≥ 6.29.x).
- New upstream tests that `import matter from "gray-matter"` must read through `../src/util/front-matter.js` (cards.test.ts did).

## Tried and ruled out
- `npm install -g github:ansidium/trail-code-se7en` on npm 11.9 / Windows: the git clone's inner `npm install` inherits the global flag, retires the installed package, installs no devDependencies, and `prepare` fails with `tsc` not found. It leaves `trail`/`graft` without `dist/` until reinstalled. `trail upgrade` runs the same command. Working paths: `npm pack` a local build and `npm install -g <tgz>`, or `npx --package github:ansidium/trail-code-se7en` (its cache is not global; first start ~70 s, cached ~7 s).

## Watch out
- Escapes like ` ` typed into a Bash/Python command reach the file as raw U+2028, which breaks a regex literal. Fix files with `String.fromCharCode` in a script file instead.
- Two `mcp-tools` tests ("graft_repo_map round-trips…", "an old name dispatches…") failed once in a full run with "refreshed the graph (? files changed)" and passed alone and in a full rerun: timing flake under load, not a merge regression.
