/**
 * Shared safe front matter for cards, learnings and skills.
 *
 * gray-matter picks its parser from the opening fence: `---js` or
 * `---javascript` front matter is run through `eval`. Every file read here
 * comes from a repo — a learning committed by a teammate or sitting on their
 * pushed branch, a skill, a graft/ card — so a file that opened with `---js`
 * would run its code on whoever reads it. Here those fences return empty
 * metadata without evaluating the header. YAML/JSON and the existing safe
 * scalar semantics use the shared js-yaml adapter, without gray-matter's
 * obsolete dependency chain.
 */
import legacyMatter, { type FrontmatterFile } from "./frontmatter.js";

export type FrontMatterFile = FrontmatterFile;

const CODE_ENGINES = new Set(["js", "javascript", "coffee", "coffeescript", "cson"]);

function parse(text: string | Buffer): FrontMatterFile {
  const content = (Buffer.isBuffer(text) ? text.toString("utf8") : text).replace(/^\uFEFF/, "");
  const opening = /^---(?!-)([^\r\n]*)/.exec(content);
  const language = opening?.[1]?.trim().toLowerCase();
  if (opening && language && CODE_ENGINES.has(language)) {
    // Keep the markdown body, but never pass executable metadata to a parser.
    const rest = content.slice(opening[0].length);
    const closing = rest.indexOf("\n---");
    return {
      data: {}, language,
      content: closing < 0 ? "" : rest.slice(closing + 4).replace(/^\r/, "").replace(/^\n/, ""),
    };
  }
  return legacyMatter(text);
}

/** Safe YAML/JSON parsing and serialization; executable fences never run. */
export const matter = Object.assign(parse, {
  stringify: legacyMatter.stringify,
});
