/**
 * `graft version` / `graft --version` / `graft upgrade` support.
 *
 * Split out of cli.ts so the formatting helpers can be unit-tested with
 * injected results instead of hitting the network from tests.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toPosixPath } from "./util/paths.js";
import { brand, PACKAGE_FOR } from "./brand.js";
import { FORK_INSTALL, FORK_PACKAGE, FORK_SETUP } from "./fork.js";

/** Locates package.json relative to a module URL (works for both `dist/cli.js`
 * running one level under the published package root, and `src/cli.ts` running
 * one level under the repo root via tsx). */
export function resolvePackageJsonPath(moduleUrl: string): string {
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const candidates = [resolve(moduleDir, "..", "package.json"), resolve(moduleDir, "package.json")];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * The npm package this code was installed as: `@trailhq/trail-code`, or
 * `@nanonets/graft` (the same code under its old name). Upgrades and update
 * checks go to the package actually installed, not to the name typed.
 */
export function readPackageName(moduleUrl: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolvePackageJsonPath(moduleUrl), "utf8")) as { name?: string };
    return pkg.name ?? PACKAGE_FOR.graft;
  } catch {
    return PACKAGE_FOR.graft;
  }
}

const PKG_NAME = readPackageName(import.meta.url);
const UPDATE_PACKAGE = PKG_NAME === FORK_PACKAGE ? PACKAGE_FOR.trail : PKG_NAME;

/** Reads the version of the graft package this module was loaded from. */
export function readCurrentVersion(moduleUrl: string): string {
  const raw = readFileSync(resolvePackageJsonPath(moduleUrl), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/** True when the running module lives under an npx cache dir (e.g.
 * `~/.npm/_npx/<hash>/node_modules/...`) rather than a regular global install.
 *
 * Normalized first: `fileURLToPath` returns the *platform* separator, so on
 * Windows the cache path is `…\_npx\…` and a bare `includes("/_npx/")` is always
 * false — `graft upgrade` would then run `npm install -g` on top of an npx run.
 * Same hardcoded-`/` mistake as #33; `src/util/paths.ts` exists for exactly this. */
export function isRunningViaNpx(moduleUrl: string): boolean {
  return toPosixPath(fileURLToPath(moduleUrl)).includes("/_npx/");
}

export interface NpmInvocation {
  command: string;
  args: string[];
  shell: boolean;
}

/** How to launch `npm <args>` on `platform`.
 *
 * On Windows `npm` is a `.cmd` shim that only a shell can start: spawned
 * directly it fails with ENOENT, so `graft version` always read "unreachable",
 * the background update check never stored an answer, and `graft upgrade`
 * could not run. The shell gets one pre-joined command line rather than an args
 * array, because Node 24 warns (DEP0190) whenever it has to concatenate args
 * for a shell itself. Every arg passed here is a fixed token, never user input. */
export function npmInvocation(args: readonly string[], platform: NodeJS.Platform = process.platform): NpmInvocation {
  if (platform === "win32") return { command: ["npm", ...args].join(" "), args: [], shell: true };
  return { command: "npm", args: [...args], shell: false };
}

function npmSync(args: readonly string[], options: SpawnSyncOptions) {
  const inv = npmInvocation(args);
  return spawnSync(inv.command, inv.args, { ...options, shell: inv.shell });
}

export interface NpmViewResult {
  ok: boolean;
  version?: string;
}

/** `npm view <pkg> version`, offline-safe: any failure (no npm, no network,
 * timeout) resolves to `{ ok: false }` rather than throwing. */
export function getNpmViewVersion(pkgName: string = UPDATE_PACKAGE, timeoutMs = 2000): NpmViewResult {
  try {
    const res = npmSync(["view", pkgName, "version"], {
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
    });
    if (res.error || res.signal || res.status !== 0) return { ok: false };
    const version = res.stdout?.toString().trim();
    if (!version) return { ok: false };
    return { ok: true, version };
  } catch {
    return { ok: false };
  }
}

/** Pure formatter for `graft version` — no I/O, easy to unit-test. */
export function formatVersionReport(current: string, latest: NpmViewResult): string {
  const lines = [`${brand()} ${current}`];
  if (!latest.ok || !latest.version) {
    lines.push("latest: unreachable (offline?)");
  } else if (latest.version === current) {
    lines.push(`latest on npm: ${current} ✓ up to date`);
  } else {
    lines.push(`latest on npm: ${latest.version} — run ${brand()} upgrade`);
  }
  return lines.join("\n");
}

/** The global npm node_modules dir (handles Homebrew/Windows/volta layouts). */
function globalRoot(): string | null {
  try {
    const res = npmSync(["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    if (res.error || res.status !== 0) return null;
    return res.stdout?.toString().trim() || null;
  } catch {
    return null;
  }
}

/** Reads the version actually sitting in the global install, straight from
 * disk — more reliable right after `npm install -g` than re-querying the
 * registry (which just tells you what "latest" is, not what landed locally). */
export function readGlobalInstalledVersion(pkgName: string = PKG_NAME): string | null {
  const root = globalRoot();
  if (!root) return null;
  const pkgJson = join(root, ...pkgName.split("/"), "package.json");
  if (!existsSync(pkgJson)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export interface UpgradeResult {
  /** True when the install ran. */
  ran: boolean;
  ok: boolean;
  /** Present when ran=true and the install failed. */
  errorMessage?: string;
  oldVersion?: string;
  newVersion?: string;
  /** The `trail` package's version, when `graft upgrade` installed it alongside. */
  trailVersion?: string;
}

/** Pure formatter for a finished upgrade — no I/O, easy to unit-test. */
export function formatUpgradeReport(result: UpgradeResult): string {
  if (!result.ok) {
    return `✗ installing ${FORK_INSTALL} failed${result.errorMessage ? `: ${result.errorMessage}` : ""}. Retry with: ${FORK_SETUP}`;
  }
  const line = `${brand()} ${result.oldVersion ?? "(not installed)"} → ${result.newVersion ?? result.oldVersion ?? "?"}`;
  return result.trailVersion ? `${line}\n✓ trail ${result.trailVersion} installed too — graft keeps working, and trail is its new name` : line;
}

/** Package names npm's `--allow-scripts` takes: a comma-joined list, nothing a shell would read. */
const ALLOW_SCRIPTS = /^[@\w./-]+(?:,[@\w./-]+)*$/;

/**
 * Installs the Delphi-capable fork from GitHub in two steps, because
 * `npm install -g github:…` can't. npm builds a git dependency by running its
 * own `npm install` in the clone, and under a global install that inner run
 * inherits the global flag (npm 11 on Windows): it installs no devDependencies,
 * `prepare` stops on a missing `tsc`, and the copy already installed is left
 * without its `dist/`. `npm pack` builds the clone outside any global install;
 * `npm install -g` then only unpacks the finished tarball, so the installed
 * copy is replaced only by one that built.
 */
export function installFork(allowScripts: readonly string[] = []): { ok: boolean; errorMessage?: string } {
  const list = allowScripts.join(",");
  if (list && !ALLOW_SCRIPTS.test(list)) return { ok: false, errorMessage: `not a package list: ${list}` };
  const dir = mkdtempSync(join(tmpdir(), "trail-upgrade-"));
  // A global flag inherited from an npm script would put the pack's build back in global mode.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toLowerCase() === "npm_config_global") delete env[k];
  try {
    const pack = npmSync(["pack", FORK_INSTALL], { cwd: dir, env, stdio: ["ignore", "ignore", "inherit"] });
    if (pack.error || (pack.status ?? 1) !== 0) return { ok: false, errorMessage: pack.error?.message ?? "npm pack could not build it" };
    // Relative and checked, so the Windows shell line never carries a path it would split.
    const tarball = readdirSync(dir).find((f) => /^[\w.-]+\.tgz$/.test(f));
    if (!tarball) return { ok: false, errorMessage: "npm pack left no tarball" };
    const res = npmSync(["install", "-g", ...(list ? [`--allow-scripts=${list}`] : []), `./${tarball}`], { cwd: dir, env, stdio: "inherit" });
    if (res.error || (res.status ?? 1) !== 0) return { ok: false, errorMessage: res.error?.message };
    return { ok: true };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* the OS temp cleaner gets it */
    }
  }
}

/** Installs the fork (inheriting stdio so the user sees npm's own progress and
 * errors), then re-reads the freshly installed version. From npx too: there,
 * `${FORK_SETUP}` is how the fork gets installed for good. */
export function runUpgrade(moduleUrl: string, allowScripts: readonly string[] = []): UpgradeResult {
  const oldVersion = isRunningViaNpx(moduleUrl) ? (readGlobalInstalledVersion(FORK_PACKAGE) ?? undefined) : readCurrentVersion(moduleUrl);
  // Both CLI names ship in one package, never alongside a Delphi-less upstream.
  const res = installFork(allowScripts);
  if (!res.ok) return { ran: true, ok: false, oldVersion, errorMessage: res.errorMessage };
  const newVersion = readGlobalInstalledVersion(FORK_PACKAGE) ?? oldVersion;
  return { ran: true, ok: true, oldVersion, newVersion };
}
