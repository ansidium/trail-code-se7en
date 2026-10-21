/**
 * Executable front matter never runs: gray-matter would eval `---js`, and
 * learnings, skills and graft/ cards all come from repos, a teammate's pushed
 * branch included.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matter } from "../src/util/front-matter.js";
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
  const parsed = matter("---\ntitle: Retries stay at four\nauthor: Anirudh\n---\n## Decided\nfour\n");
  assert.equal(parsed.data.title, "Retries stay at four");
  assert.match(matter.stringify("body", { title: "x" }), /^---\ntitle: x\n---\n/);
});
