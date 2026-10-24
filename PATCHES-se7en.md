# Se7en patch inventory

This file inventories the fork delta from `trailhq/Trail-Code`.

The fork is synchronized with upstream `0.25.0` (`257672a`) and is named
`trail-code-se7en`. Its primary command is `trail`; `graft` remains a compatible
alias from the same package, not a second installation. Pascal's
case-insensitive resolution remains compatible with upstream's language-family
filtering, Swift dispatch, and PHP trait resolution. Regression coverage includes
cross-unit Pascal inheritance and mixed Pascal/TypeScript name collisions.

Fork release `0.23.2` fixed Delphi inline-variable parsing without rewriting
counted-loop membership expressions. Fork release `0.23.3` carries that fix onto
the newer upstream base, including Gleam support, `web-tree-sitter` `0.27` (the
checked-in Pascal grammar still loads under it), and upstream's refusal of YAML
anchors and aliases, ported onto the fork's `js-yaml` adapter. Fork release
`0.23.4` installs from GitHub without `npm install -g github:…`, which npm 11
cannot build inside a global install. Fork release `0.25.0` retains these
contracts while adopting upstream's learned skills, readiness probes, init
review, and lightweight shell hooks.

## Modified upstream files

- `package.json` — names the fork `trail-code-se7en`, exports both CLI entry points, identifies the fork repository, and replaces `gray-matter` with modern `js-yaml` and development types.
- `package-lock.json` — keeps the fork package name, removes the obsolete frontmatter dependency chain, and keeps `undici` at `6.29.1` or later (upstream locks `6.28.0`), including the fixes for `GHSA-rfgv-xxqx-mfg5`, `GHSA-3wwx-pv8p-q78v`, and `GHSA-r53p-7pc4-xj5r`.
- `README.md` — documents the fork's Pascal/Delphi support and upstream update flow.
- `src/graph/extract.ts` — adds the optional case-insensitive resolver intent used by Pascal edges.
- `src/graph/generic.ts` — registers Pascal in the existing WASM language registry, delegates to its focused extractor, and adds an optional same-length `prepare` hook whose output is fed only to the parser (Pascal uses it for conditional directives and unsupported inline declarations; extractors still receive the original source).
- `src/graph/resolve.ts` — resolves Pascal identifiers, typed methods, inheritance, and unit imports case-insensitively. The Pascal import branch sits before upstream's C, Rust, PHP and Gleam branches.
- `src/graph/workspace.ts` — narrows call tracing by workspace child before applying an optional in-repo path scope.
- `src/context/node-file.ts`, `src/graph/cards.ts`, `src/ask/ask.ts`, `src/viz/assemble.ts`, `src/util/front-matter.ts` — use the shared safe frontmatter adapter, including new upstream consumers and inert executable-engine fences. `front-matter.ts` keeps upstream's API (`refused`, `scalars`, `textList`, `warnSkipped`) and its anchor/alias refusal, applied through the adapter's `js-yaml` `listener` instead of gray-matter.
- `src/mcp/tools.ts` — routes workspace-prefixed file API requests to the owning child graph.
- `src/hosts/mcp-config.ts` — defaults both MCP brands to an explicit `npx --package github:ansidium/trail-code-se7en <brand> mcp`, so an official binary on PATH cannot silently remove Delphi support. The explicit binary override remains available to callers.
- `src/cli-meta.ts`, `src/cli.ts` — both upgrade commands install the GitHub fork by `npm pack` of the git source into a temp folder, then `npm install -g` of the built tarball, so a failed build never touches the installed copy. `upgrade` also runs from npx (that is the first install) and takes `--allow-scripts`. Update checks follow the official Trail version without installing it. npm is launched correctly through its Windows `.cmd` shim.
- `src/claude/shim-template.ts` — generated hooks resolve only the renamed or legacy fork, prefer the renamed fork, and offer the fork installer. Portable tracked helper copies are regenerated without machine paths.
- `src/brand.ts`, `src/claude/hook-layers.ts` — recognize fork-aware Trail shims so global/repo hooks do not double-run or falsely report a stranded installation.
- `src/claude/skill-template.ts`, `scripts/postinstall.mjs`, `src/graph/native.ts` — installation guidance and postinstall branding use the renamed fork; every install hint is `FORK_SETUP` (`npx -y --package github:ansidium/trail-code-se7en trail upgrade`).
- `src/upkeep.ts` — update nudges retain the running brand and direct maintainers to synchronize the fork and run `FORK_SETUP`.
- `scripts/run-tests.mjs` — runs the suite under a throwaway home (`HOME` and `USERPROFILE`, with its own git identity), created inside upstream's per-run temp folder so one cleanup removes both. `graft init` retracts every agent it isn't wiring, so tests that spawn it without their own home rewired the developer's real `~/.claude` and `~/.codex`. Windows runs at most four test files concurrently so competing git spawns do not consume the unchanged readiness-probe deadlines.
- `src/ask/ask.ts`, `src/context/savings.ts`, `src/claude/format.ts`, `src/claude/session-metrics.ts` — keep locale-stable numeric formatting while retaining upstream's savings reporting.
- `test/mcp-tools.test.ts` — covers workspace file API routing.
- `test/covers.test.ts` — exercises the same frontmatter adapter as production.
- `test/hosts-mcp-config.test.ts`, `test/cli-meta.test.ts`, `test/upkeep.test.ts`, `test/upkeep-hooks.test.ts`, `test/claude-shim-resolve.test.ts`, `test/trail-notes.test.ts`, `test/graph-native-fallback.test.ts` — assertions follow the GitHub launch/upgrade lines above; `test/cli-meta.test.ts` also covers how npm is launched on each platform.
- Hook global-copy and pre-bash fixtures expose the fork package. Windows fixtures use native file operations, keep the POSIX zombie check platform-specific, and preserve the process-exit proof everywhere. The generated Trail skill fixture retains `FORK_SETUP`.

## Added files

- `src/graph/pascal.ts` — Pascal/Delphi symbols, spans, imports, bindings, deduplication, and call extraction. Before parsing, `preparePascalSource` neutralizes conditionals that split a routine and unsupported inline `for var X[: T] in`/`var A, B: T` syntax with same-length edits. Routine sections, parameters, supported counted loops and original source spans are preserved, including counted-loop initializers containing `in` expressions.
- `src/fork.ts` — the package identity, the GitHub source, and `FORK_SETUP`, the one install/upgrade command shared by upgrades, agent configuration and hook templates.
- `test/graph-pascal.test.ts` — unit, program, package, include, line-ending, large-file, conditional/inline-variable span, counted-loop preparation, and call-resolution coverage.
- `src/util/frontmatter.ts`, `src/util/frontmatter-schema.ts` — the YAML/JSON frontmatter API and safe legacy scalar compatibility, retaining node body bytes and stable serialization. Parsing accepts a `js-yaml` `listener`; serialization writes with `noRefs`, so nothing it writes is refused on read.
- `test/frontmatter.test.ts` — delimiter, scalar, serialization, parser-error, and removed-dependency regression coverage.
- `scripts/grammars/tree-sitter-pascal.wasm` — prebuilt Pascal grammar for `web-tree-sitter`.
- `scripts/grammars/tree-sitter-pascal.LICENSE` — upstream grammar license.
- `PATCHES-se7en.md` — this inventory.

## Dependency audit

The shared frontmatter adapter removes `gray-matter` and its obsolete
`js-yaml -> argparse -> sprintf-js` chain (`GHSA-hp3w-g68c-fv3c`). The modern
direct YAML dependency uses `argparse` 2 without `sprintf-js`, so the fix also
applies when this package is installed as a Git/npx dependency. Existing safe
scalar interpretations are retained without restoring an executable engine.

## Grammar provenance

- Source: `https://github.com/Isopod/tree-sitter-pascal`
- Revision: `042119eca2e18a60e56317fb06ee3ba5c32cb447` (`0.10.2`)
- License: MIT
- Toolchain used for the checked-in artifact: `tree-sitter-cli 0.24.7`, Emscripten `6.0.7`
- Artifact SHA-256: `09ce32de1653832194a21173e9fc66fecbc377e1da8fe8b2b7cafa96cac734cf`

Rebuild from the pinned grammar checkout with:

```sh
npx tree-sitter build --wasm --output tree-sitter-pascal.wasm
```

Copy the resulting file to `scripts/grammars/tree-sitter-pascal.wasm`, then verify the recorded SHA-256, `npm run build`, the focused Pascal tests, and `npm pack --dry-run` before committing an artifact update.
