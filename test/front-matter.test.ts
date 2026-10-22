/**
 * Executable front matter never runs: gray-matter would eval `---js`, and
 * learnings, skills and graft/ cards all come from repos, a teammate's pushed
 * branch included.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matter, textList } from "../src/util/front-matter.js";
import legacyMatter from "../src/util/frontmatter.js";
import { parseNote } from "../src/notes/notes.js";
import { parseTakeaway } from "../src/skills/skills.js";

const g = globalThis as { __ranFrontMatter?: number };

test("code front matter never runs, under any spelling of the fence", () => {
  for (const fence of ["js", "javascript", "JS", "Javascript", "coffee", "coffeescript", "cson", "CoFfEeScRiPt"]) {
    const text = `---${fence}\n{ title: (globalThis.__ranFrontMatter = (globalThis.__ranFrontMatter || 0) + 1, "Retries") }\n---\n## Decided\nfour\n`;
    const parsed = matter(text);
    assert.deepEqual(parsed.data, {}, fence);
    assert.equal(parsed.content, "## Decided\nfour\n", `${fence}: the markdown body is preserved`);
    assert.equal(parseNote(text, "x.md"), null, `${fence}: a learning with no YAML title is skipped`);
    assert.equal(parseTakeaway(text, "x.md", "s")?.text.includes("globalThis") ?? false, false);
  }
  assert.equal(g.__ranFrontMatter, undefined);
});

test("the shared facade retains the safe adapter's YAML/JSON/body and scalar compatibility", () => {
  const fixtures = [
    "plain\r\nbody",
    "\uFEFF---\r\ntitle: Example\r\n---\r\n# Notes\r\n",
    "---yml\noctal: 0123\nbase60: 1:23\nbytes: !!binary SGVsbG8=\n---\nBody",
    '---json\n{"title":"Example"}\n---\nBody',
    "---\nfalse\n---\nBody",
    "---\n0\n---\nBody",
    "---\nnull\n---\nBody",
    "---\n[one, two]\n---\nBody",
    "---\ntitle: Example",
    "---\ntitle: Example\n---suffix\nBody",
    "----\nmarkdown rule\n",
  ];
  for (const text of fixtures) assert.deepEqual(matter(text), legacyMatter(text));
  assert.deepEqual(matter(Buffer.from(fixtures[1]!)), legacyMatter(Buffer.from(fixtures[1]!)));
  const input = "---\ntitle: Existing\n---\n# Human notes\r\n";
  const data = { formats: ["%.101f", "%.999999999f"], numericStrings: ["0123", "1:23"] };
  assert.equal(matter.stringify(input, data), legacyMatter.stringify(input, data));
  assert.equal(matter(matter.stringify(input, data)).content, "# Human notes\r\n");
  assert.throws(() => matter("---toml\nname = 'x'\n---\nBody"), /Unsupported frontmatter language/);
  assert.throws(() => matter("---\nname: [\n---\nBody"), { name: "YAMLException" });
  assert.throws(() => matter.stringify("---js\nglobalThis.__ranFrontMatter = 1\n---\nBody", {}), /Unsupported frontmatter language/);
  assert.equal(g.__ranFrontMatter, undefined);
});

test("YAML front matter still parses, and stringify still writes it", () => {
  const parsed = matter("---\ntitle: Retries stay at four\nauthor: Maya\n---\n## Decided\nfour\n");
  assert.equal(parsed.data.title, "Retries stay at four");
  assert.match(matter.stringify("body", { title: "x" }), /^---\ntitle: x\n---\n/);
});

/** Nine levels of nested aliases in under 500 bytes: read naively, `touches` is 387 million strings. */
const BOMB = [
  "---",
  "title: Retries",
  'a: &a ["lol","lol","lol","lol","lol","lol","lol","lol","lol"]',
  ...["b", "c", "d", "e", "f", "g", "h"].map((k, i) => `${k}: &${k} [${Array(9).fill(`*${"abcdefg"[i]}`).join(",")}]`),
  `touches: [${Array(9).fill("*h").join(",")}]`,
  "---",
  "## Decided",
  "four",
  "",
].join("\n");

test("YAML anchors and aliases are refused: a 400-byte alias bomb is turned away at once", () => {
  assert.ok(BOMB.length < 500, `${BOMB.length} bytes`);
  const started = performance.now();
  const parsed = matter(BOMB);
  assert.deepEqual(parsed.data, {});
  assert.match(parsed.refused ?? "", /anchors and aliases/);
  assert.equal(parsed.content.trim(), "## Decided\nfour", "the body is still there to read");
  assert.equal(parseNote(BOMB, "x.md"), null);
  assert.ok(performance.now() - started < 250, `took ${Math.round(performance.now() - started)} ms`);
});

test("one anchor or one alias is enough to refuse the front matter", () => {
  assert.match(matter("---\ntitle: &t Retries\nauthor: Priya\n---\nx\n").refused ?? "", /anchors and aliases/);
  assert.match(matter("---\ntitle: Retries\nauthor: *who\n---\nx\n").refused ?? "", /anchors and aliases/);
  assert.match(matter("---\ntitle: Retries\nlist: &l [a, *l]\n---\nx\n").refused ?? "", /anchors and aliases/, "a list that holds itself");
  // `&` and `*` inside a value are just characters.
  const fine = matter('---\ntitle: R&D *args and "quoted *x &y"\nauthor: "*Priya&"\n---\nx\n');
  assert.equal(fine.refused, undefined);
  assert.equal(fine.data.title, 'R&D *args and "quoted *x &y"');
  assert.equal(fine.data.author, "*Priya&");
});

test("a list or a map where one value belongs refuses the whole front matter", () => {
  const scalars = ["title", "author", "date"];
  assert.match(matter("---\ntitle: [a, b]\n---\nx\n", { scalars }).refused ?? "", /title/);
  assert.match(matter("---\ntitle: x\nauthor: { name: Priya }\n---\nx\n", { scalars }).refused ?? "", /author/);
  assert.deepEqual(matter("---\ntitle: x\ndate: [2026, 10]\n---\nx\n", { scalars }).data, {});
  const ok = matter("---\ntitle: x\nauthor: Priya\ndate: 2026-10-07\nlevel: 3\nflag: true\nnothing: null\ntouches: [a.go]\n---\nx\n", { scalars: [...scalars, "level", "flag", "nothing"] });
  assert.equal(ok.refused, undefined);
  assert.equal(ok.data.title, "x");
  for (const bad of ["---\ntitle: [a]\n---\n", "---\nauthor: {a: 1}\n---\n", "---\ntitle: x\ndate: [1]\n---\n"]) {
    assert.equal(parseNote(`${bad}## Decided\nfour\n`, "x.md"), null, bad);
  }
});

test("touches keep only short strings, at most 10 of them", () => {
  const many = Array.from({ length: 14 }, (_, i) => `f${i}.go`);
  const text = `---\ntitle: Retries\ntouches:\n  - a.go\n  - 42\n  - { x: 1 }\n  - [b.go]\n  - "c\\nd.go"\n  - ${"x".repeat(301)}\n${many.map((f) => `  - ${f}`).join("\n")}\n---\nbody\n`;
  const n = parseNote(text, "x.md")!;
  assert.deepEqual(n.touches, ["a.go", ...many.slice(0, 9)]);
  assert.deepEqual(textList("a.go", 10, 300), [], "not a list, nothing");
});

test("stringify never writes an anchor, so whatever is written reads back", () => {
  const shared = ["a.go"];
  const text = matter.stringify("body", { sources: shared, touches: shared });
  assert.doesNotMatch(text, /&ref|\*ref/);
  assert.deepEqual(matter(text).data, { sources: ["a.go"], touches: ["a.go"] });
});
