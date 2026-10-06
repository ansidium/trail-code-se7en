# Se7en patch inventory

This file inventories the fork delta from `trailhq/Graft`.

The fork is synchronized with upstream `0.21.1` (`fe30ead`). Pascal's
case-insensitive resolution remains compatible with upstream's language-family
filtering, Swift dispatch, and PHP trait resolution. Regression coverage includes
cross-unit Pascal inheritance and mixed Pascal/TypeScript name collisions.

## Modified upstream files

- `package.json` — names the fork `graft-se7en` and replaces `gray-matter` with a direct modern `js-yaml` dependency and its development types.
- `package-lock.json` — keeps the fork package name, removes the obsolete frontmatter dependency chain, and retains `undici` `6.29.0`, including the fixes for `GHSA-rfgv-xxqx-mfg5`, `GHSA-3wwx-pv8p-q78v`, and `GHSA-r53p-7pc4-xj5r`.
- `README.md` — documents the fork's Pascal/Delphi support and upstream update flow.
- `src/graph/extract.ts` — adds the optional case-insensitive resolver intent used by Pascal edges.
- `src/graph/generic.ts` — registers Pascal in the existing WASM language registry and delegates to its focused extractor.
- `src/graph/resolve.ts` — resolves Pascal identifiers, typed methods, inheritance, and unit imports case-insensitively.
- `src/graph/workspace.ts` — narrows call tracing by workspace child before applying an optional in-repo path scope.
- `src/context/node-file.ts`, `src/graph/cards.ts`, `src/ask/ask.ts`, `src/viz/assemble.ts` — use the shared safe frontmatter adapter.
- `src/mcp/tools.ts` — routes workspace-prefixed file API requests to the owning child graph.
- `src/hosts/mcp-config.ts` — points the MCP `npx` launch line at `github:ansidium/graft-se7en` so the wiring self-heal never rewrites configs back to the npm registry package.
- `src/cli-meta.ts` — `graft upgrade` installs from `github:ansidium/graft-se7en` instead of `@nanonets/graft@latest` (which would replace the fork with upstream). npm is launched through the shell on Windows, where it is a `.cmd` shim, so `graft version`, the background update check, and `graft upgrade` work there.
- `src/upkeep.ts` — the update nudge suggests rebasing the fork and reinstalling from GitHub rather than `npm i -g @nanonets/graft@latest`.
- `scripts/run-tests.mjs` — runs the suite under a throwaway home (`HOME` and `USERPROFILE`, with its own git identity). `graft init` retracts every agent it isn't wiring, so tests that spawn it without their own home rewired the developer's real `~/.claude` and `~/.codex`.
- `src/ask/ask.ts`, `src/context/savings.ts`, `src/claude/format.ts`, `src/claude/session-metrics.ts` — keep locale-stable numeric formatting while retaining upstream's savings reporting.
- `test/mcp-tools.test.ts` — covers workspace file API routing.
- `test/covers.test.ts` — exercises the same frontmatter adapter as production.
- `test/hosts-mcp-config.test.ts`, `test/cli-meta.test.ts`, `test/upkeep.test.ts`, `test/upkeep-hooks.test.ts` — assertions follow the GitHub launch/upgrade lines above; `test/cli-meta.test.ts` also covers how npm is launched on each platform.

## Added files

- `src/graph/pascal.ts` — Pascal/Delphi symbols, spans, imports, bindings, deduplication, and call extraction.
- `test/graph-pascal.test.ts` — unit, program, package, include, line-ending, large-file, and call-resolution coverage.
- `src/util/frontmatter.ts`, `src/util/frontmatter-schema.ts` — the YAML/JSON frontmatter API and safe legacy scalar compatibility, retaining node body bytes and stable serialization.
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
