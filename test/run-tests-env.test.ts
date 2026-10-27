/** The actual suite runner must not inherit a contributor's external homes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { trailHome } from "../src/notes/home.js";

const runnerUrl = new URL("../scripts/run-tests.mjs", import.meta.url);
const runnerSource = readFileSync(runnerUrl, "utf8")
  .replace(/^import [^;]+;\s*$/gm, "")
  .replaceAll("import.meta.url", "runnerUrl");

test("the Windows runner keeps enumerated test paths relative in a deep checkout", () => {
  const files = Array.from({ length: 600 }, (_, i) => `unit-${String(i).padStart(4, "0")}.test.ts`);
  const deepUrl = new URL(`../${"long-subdirectory/".repeat(20)}scripts/run-tests.mjs`, import.meta.url);
  let childArgs: string[] = [];
  let childCwd = "";
  runInNewContext(runnerSource, {
    runnerUrl: deepUrl.href,
    dirname, join, resolve, fileURLToPath,
    tmpdir: () => resolve("virtual", "temp"),
    readdirSync: () => files,
    mkdtempSync: () => resolve("virtual", "scratch"),
    writeFileSync: () => {}, rmSync: () => {},
    spawnSync: (_command: string, args: string[], options: { cwd: string }) => {
      childArgs = args;
      childCwd = options.cwd;
      return { status: 0 };
    },
    process: {
      env: {}, platform: "win32", execPath: resolve("virtual", "node.exe"),
      exit: (code: number) => assert.equal(code, 0),
    },
    console: { error: (...args: unknown[]) => assert.fail(args.join(" ")) },
  });
  assert.equal(childCwd, resolve(dirname(fileURLToPath(deepUrl)), ".."));
  assert.deepEqual(Array.from(childArgs.filter(arg => arg.endsWith(".test.ts"))), files.map(file => join("test", file)));
  assert.ok(childArgs.includes("--test-concurrency=4"));
  assert.ok(childArgs.join(" ").length < 32767, "a deep checkout must not expand every test argument into an absolute path");
});

for (const externalTrailHome of [undefined, resolve("external", "custom-trail-home")]) {
  test(`the runner confines Trail writes to its scratch home with TRAIL_HOME ${externalTrailHome ? "set" : "unset"}`, () => {
    const scratch = resolve("virtual", "suite-home");
    const inherited: NodeJS.ProcessEnv = {
      HOME: resolve("external", "home"),
      USERPROFILE: resolve("external", "profile"),
      CLAUDE_CONFIG_DIR: resolve("external", "claude"),
      UNRELATED_TEST_VALUE: "keep",
      ...(externalTrailHome ? { TRAIL_HOME: externalTrailHome } : {}),
    };
    const writes = new Map<string, string>();
    const removed: string[] = [];
    const exits: number[] = [];
    let childEnv: NodeJS.ProcessEnv | undefined;
    let spawns = 0;

    // Execute the real runner's environment construction. Every filesystem
    // operation, subprocess and process mutation in that execution is fake.
    runInNewContext(runnerSource, {
      runnerUrl: runnerUrl.href,
      dirname, join, resolve, fileURLToPath,
      tmpdir: () => resolve("virtual", "temp"),
      readdirSync: () => ["run-tests-env.test.ts"],
      mkdtempSync: () => scratch,
      writeFileSync: (path: string, content: string) => writes.set(path, content),
      rmSync: (path: string) => removed.push(path),
      spawnSync: (_command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
        spawns++;
        assert.ok(args.includes("--test"));
        childEnv = options.env;
        return { status: 0 };
      },
      process: {
        env: inherited,
        execPath: resolve("virtual", "node"),
        exit: (status: number) => exits.push(status),
      },
      console: { error: (...args: unknown[]) => assert.fail(`unexpected runner error: ${args.join(" ")}`) },
    });

    assert.equal(spawns, 1, "the mocked runner never recursively executes a suite");
    assert.ok(childEnv);
    assert.equal(childEnv.HOME, scratch);
    assert.equal(childEnv.USERPROFILE, scratch);
    assert.equal(childEnv.TRAIL_HOME, undefined);
    assert.equal(childEnv.CLAUDE_CONFIG_DIR, undefined);
    assert.equal(childEnv.UNRELATED_TEST_VALUE, "keep");
    assert.equal(trailHome(childEnv, scratch), join(scratch, ".trail"));
    assert.equal(inherited.TRAIL_HOME, externalTrailHome, "the parent environment is unchanged");
    assert.equal(writes.size, 1);
    assert.match(writes.get(join(scratch, ".gitconfig")) ?? "", /tests@graft\.invalid/);
    assert.deepEqual(removed, [scratch]);
    assert.deepEqual(exits, [0]);
  });
}
