---
title: Windows hook fixtures need the fork identity
author: Ansidium
date: 2026-10-24
branch: sync/upstream-0.25.0-20261024
id: l-166551a2
scope: repo
status: active
touches:
  - scripts/run-tests.mjs
  - src/claude/hook-layers.ts
  - test/claude-pre-bash.test.ts
  - test/claude-hook-timeouts.test.ts
  - test/init-keep.test.ts
  - test/learnings-link-1b-review.test.ts
  - test/skills-probes.test.ts
  - test/fixtures/skills/trail/SKILL.md
---

## Decided
- `test/claude-pre-bash.test.ts` and the global-copy hook fixtures must expose `trail-code-se7en`. The fork deliberately refuses official-only shims: standing down for one could select a package without Pascal support.
- Windows fixtures use `mkdirSync`, `rmSync` and `unlinkSync` instead of shell `mkdir -p` and `rm`. The POSIX `ps` zombie check is guarded by platform; the child's exit proof still runs everywhere.
- `scripts/run-tests.mjs` limits Windows test files to four workers. Hundreds of modules competing to spawn git exceeded the unchanged 150 ms readiness-probe deadline; bounded test contention preserves the real deadline and its timeout tests.

## Tried and ruled out
- Increasing the production probe timeout would hide its bounded prompt-hook behavior. Limit test workers instead.
- Replacing every upstream package literal in tests would weaken the official-only rejection scenarios. Change only fixtures representing an installed fork.

## Watch out
- `test/fixtures/skills/trail/SKILL.md` is generated from `skillTemplate("trail")` and must retain the fork's setup command. Refresh generated fixtures with a throwaway HOME and USERPROFILE, as for every init test.
