/**
 * The frontmatter API used by graph nodes: YAML/JSON metadata and an untouched
 * markdown body. Keeping it here avoids shipping a second YAML parser and the
 * obsolete CLI formatter dependency it brought in through gray-matter.
 */
import { load, dump, type LoadOptions } from "js-yaml";
import { FRONTMATTER_SCHEMA } from "./frontmatter-schema.js";

export interface FrontmatterFile {
  data: Record<string, unknown>;
  content: string;
  language: string;
}

export interface ParseOptions {
  /** Handed to js-yaml, which calls it as it opens and closes each YAML node. */
  listener?: LoadOptions["listener"];
}

function isYaml(language: string): boolean {
  return /^(yaml|yml)$/i.test(language);
}

export function parseFrontmatter(input: string | Buffer, opts: ParseOptions = {}): FrontmatterFile {
  const content = (Buffer.isBuffer(input) ? input.toString("utf8") : input).replace(/^\uFEFF/, "");
  const file: FrontmatterFile = { data: {}, content, language: "yaml" };
  // A leading markdown rule such as "----" is not an opening delimiter.
  if (!content.startsWith("---") || content.startsWith("----")) return file;

  let rest = content.slice(3);
  const openingLineEnd = rest.search(/\r?\n/);
  const rawLanguage = rest.slice(0, openingLineEnd);
  const language = rawLanguage.trim() || "yaml";
  if (!isYaml(language) && language !== "json") {
    throw new Error(`Unsupported frontmatter language: ${language}`);
  }
  if (rawLanguage.trim()) rest = rest.slice(rawLanguage.length);
  file.language = language;

  // Match existing node files, including CRLF and an unterminated header.
  const closing = rest.indexOf("\n---");
  const header = closing < 0 ? rest : rest.slice(0, closing);
  file.content = closing < 0 ? "" : rest.slice(closing + 4).replace(/^\r/, "").replace(/^\n/, "");
  const nonComment = header.replace(/^\s*#[^\n]+/gm, "").trim();
  if (nonComment) {
    const data = isYaml(language) ? load(header, { schema: FRONTMATTER_SCHEMA, listener: opts.listener }) : JSON.parse(header);
    // The old frontmatter reader normalized null/undefined in its excerpt pass.
    file.data = (data ?? {}) as Record<string, unknown>;
  }
  return file;
}

function newline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

export function stringifyFrontmatter(input: string, data: object): string {
  const file = parseFrontmatter(input);
  const combined = { ...file.data, ...data };
  // `noRefs`: an object used twice is written out twice, never as an anchor and
  // alias, which the shared reader refuses.
  const header = (isYaml(file.language) ? dump(combined, { schema: FRONTMATTER_SCHEMA, noRefs: true }) : JSON.stringify(combined, null, 2)).trim();
  const body = newline(file.content);
  return header === "{}" ? body : `---\n${header}\n---\n${body}`;
}

export default Object.assign(parseFrontmatter, { stringify: stringifyFrontmatter });
