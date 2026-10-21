/**
 * Which copy of the hooks answers an event when both are registered.
 *
 * `init` wires Claude Code twice: in the repo (`.claude/settings.json`, committed
 * for teammates) and in `~/.claude` (the floor for worktrees and ignored files,
 * see hosts/claude-global.ts). Claude Code runs both, so every prompt got its
 * learnings twice and the ask to save one came twice in a session. The
 * `~/.claude` copy runs in every folder, trusted or not, so when it covers an
 * event the repo's copy stands down for it.
 *
 * Only a `~/.claude` shim that can find this Delphi-capable fork counts. An
 * upstream Trail shim can select an official package without Delphi support;
 * standing down for it would bypass the repo's strict fork resolver. Older
 * graft-only shims cannot find the renamed fork either.
 *
 * Reads two small files and imports nothing heavier than node:fs, since every
 * hook loads it.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { FORK_PACKAGE } from "../fork.js";

/** `node "<shim>" <event>`, the form hosts/claude-global.ts writes. */
const COMMAND = /^node\s+"([^"]+)"\s+(\S+)$/;

/**
 * True when this hook process runs from the repo's shim and the `~/.claude`
 * copy also answers `event`, so this one should do nothing.
 *
 * `shim` is the path the hook was started from (`process.argv[1]`).
 */
export function globalCopyCovers(event: string, shim: string | undefined, home: string = homedir()): boolean {
  if (!shim) return false;
  const at = resolve(dirname(shim));
  // Only Claude Code's repo copy, in `.claude/helpers/` or trail's `.trail/`:
  // Cursor's and Codex's shims call the same entry, and Claude's ~/.claude
  // hooks never run for them.
  const repoCopy = basename(at) === ".trail" || (basename(at) === "helpers" && basename(dirname(at)) === ".claude");
  if (!repoCopy) return false;
  const helpers = resolve(home, ".claude", "helpers");
  if (at === helpers) return false; // this is the ~/.claude copy
  let settings: { hooks?: Record<string, unknown> };
  try {
    settings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  } catch {
    return false;
  }
  for (const groups of Object.values(settings?.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      for (const hook of (group as { hooks?: Array<{ command?: unknown }> })?.hooks ?? []) {
        const m = typeof hook?.command === "string" ? COMMAND.exec(hook.command.trim()) : null;
        if (!m || m[2] !== event || resolve(dirname(m[1]!)) !== helpers) continue;
        if (findsFork(m[1]!)) return true;
      }
    }
  }
  return false;
}

/** Branding alone is not capability: the global shim must resolve this fork. */
function findsFork(shim: string): boolean {
  try {
    return existsSync(shim) && readFileSync(shim, "utf8").includes(FORK_PACKAGE);
  } catch {
    return false;
  }
}
