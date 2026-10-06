import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import matter from "../src/util/frontmatter.js";

test("frontmatter keeps delimiter, BOM and body framing compatible", () => {
  const fixtures = [
    ["plain\r\nbody", {}, "plain\r\nbody"],
    ["\uFEFF---\r\nname: Example\r\n---\r\n# Notes\r\n", { name: "Example" }, "# Notes\r\n"],
    ["---yml\nname: Example\n---\nBody\n", { name: "Example" }, "Body\n"],
    ["---json\n{\"name\":\"Example\"}\n---\nBody", { name: "Example" }, "Body"],
    ["---\n# comment\n---\nBody", {}, "Body"],
    ["---\n\n---\n", {}, ""],
    ["----\nname: Example\n----\nBody", {}, "----\nname: Example\n----\nBody"],
    [" ---\nname: Example\n---\nBody", {}, " ---\nname: Example\n---\nBody"],
    ["---\nname: Example", { name: "Example" }, ""],
    ["---\nname: Example\n---suffix\nBody", { name: "Example" }, "suffix\nBody"],
    ["---\nname: Example\n---\rBody", { name: "Example" }, "Body"],
  ] as const;
  for (const [input, data, content] of fixtures) {
    const parsed = matter(input);
    assert.deepEqual(parsed.data, data);
    assert.equal(parsed.content, content);
  }
  assert.deepEqual(matter(Buffer.from("\uFEFF---\nname: Example\n---\nBody")).data, { name: "Example" });
});

test("frontmatter preserves scalar and array results and normalizes null", () => {
  for (const [header, value] of [["null", {}], ["false", false], ["0", 0], ["123", 123], ["[one, two]", ["one", "two"]]] as const) {
    assert.deepEqual(matter(`---\n${header}\n---\nBody`).data, value);
  }
  assert.deepEqual(matter("---json\nnull\n---\nBody").data, {});
});

test("existing nodes retain legacy YAML scalar and binary semantics", () => {
  const input = "---\noctal: 0123\nmodernOctal: 0o123\nbase60: 1:23\nfractional: 1:20.5\nnegativeFraction: -.2\nbytes: !!binary SGVsbG8=\n---\nBody";
  const parsed = matter(input);
  assert.deepEqual(parsed.data, {
    octal: 83, modernOctal: "0o123", base60: 83, fractional: 80.5,
    negativeFraction: "-.2", bytes: Buffer.from("Hello"),
  });
  const values = { numericStrings: ["0123", "1:23", "0o123", "-.2"], number: 83, negativeZero: -0, nan: NaN, bytes: Buffer.from("Hello") };
  assert.deepEqual(matter(matter.stringify("Body", values)).data, values);
});

test("frontmatter rejects malformed documents and unsupported engines", () => {
  assert.throws(() => matter("---\nname: [\n---\nBody"), { name: "YAMLException" });
  assert.throws(() => matter("---json\n{bad}\n---\nBody"), SyntaxError);
  for (const language of ["toml", "js", "javascript"]) {
    assert.throws(() => matter(`---${language}\n{}\n---\nBody`), /Unsupported frontmatter language/);
  }
  assert.throws(() => matter("---\nvalue: !!js/function 'function () {}'\n---\nBody"), { name: "YAMLException" });
});

test("frontmatter serialization preserves node data, human notes and repeated writes", () => {
  const data = {
    name: "Example: # café",
    slug: "example",
    labels: ["yes", "false", "0123", "null"],
    sources: [{ path: "Sample.pas", hash: "abc" }],
    links: [{ to: "other", relation: "depends_on", description: "quotes: 'text'" }],
    covers: [{ symbol: "Entry", kind: "function", at: "Sample.pas:L1-L3" }],
  };
  const body = "# Notes\r\n\r\nKeep this text.\r\n";
  const first = matter.stringify(body, data);
  assert.deepEqual(matter(first).data, data);
  assert.equal(matter(first).content, body);
  assert.equal(matter.stringify(first, data), first);
  const changed = matter.stringify(first, { name: "Changed" });
  assert.deepEqual(matter(changed).data, { ...data, name: "Changed" });
  assert.equal(matter(changed).content, body);
  assert.equal(matter.stringify("Body", {}), "Body\n");
  assert.equal(matter.stringify("Body\n", {}), "Body\n");
  const json = matter.stringify("---json\n{\"name\":\"Old\"}\n---\nBody", { name: "New" });
  assert.deepEqual(matter(json).data, { name: "New" });
  assert.equal(matter(json).content, "Body\n");
});

test("precision-format attack strings remain data and the vulnerable formatter is absent", () => {
  const formats = ["%.101f", "%.101e", "%.101g", "%.999999999f"];
  assert.deepEqual(matter(matter.stringify("Body", { formats })).data.formats, formats);
  const require = createRequire(import.meta.url);
  for (const dependency of ["gray-matter", "sprintf-js"]) {
    assert.throws(() => require.resolve(dependency), { code: "MODULE_NOT_FOUND" });
  }
});
