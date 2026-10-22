/**
 * Shared safe front matter for cards, learnings and skills.
 *
 * gray-matter picks its parser from the opening fence: `---js` or
 * `---javascript` front matter is run through `eval`. Every file read here
 * comes from a repo — a learning committed by a teammate or sitting on their
 * pushed branch, a skill, a graft/ card — so a file that opened with `---js`
 * would run its code on whoever reads it. Here those fences return empty
 * metadata without evaluating the header: nothing runs, and the file reads as
 * having none (a learning without a title, a card without a slug), which every
 * caller already skips. YAML/JSON and the existing safe scalar semantics use the
 * shared js-yaml adapter, without gray-matter's obsolete dependency chain.
 *
 * YAML anchors and aliases are refused the same way. An alias is a reference,
 * so a few hundred bytes of nested ones (`b: &b [*a,*a,*a,...]`, nine deep)
 * parse at once and then become hundreds of millions of strings the moment
 * anything reads the value as text: seconds and gigabytes per read, then a
 * crash. Nothing trail writes has one (`stringify` writes with `noRefs`), so a
 * file that does reads as having no front matter, with `refused` saying why.
 * So does a list or a map under a key the caller names in `scalars`, where
 * one value belongs.
 */
import type { EventType, State } from "js-yaml";
import legacyMatter, { type FrontmatterFile, type ParseOptions } from "./frontmatter.js";

export type FrontMatterFile = FrontmatterFile & {
  /** Why the front matter wasn't read, when it wasn't. `data` is then `{}`. */
  refused?: string;
};

export interface FrontMatterOptions {
  /** Keys that hold one value each (text, a number, true/false, a date), when present. */
  scalars?: readonly string[];
}

const CODE_ENGINES = new Set(["js", "javascript", "coffee", "coffeescript", "cson"]);

const NO_REFS = "YAML anchors and aliases aren't read";

/** Thrown from inside the YAML reader to stop it at the first anchor or alias. */
class Refused extends Error {}

/** A stand-in for js-yaml's table of anchors: naming an anchor, or looking one up for an alias, stops the read. */
const NO_ANCHORS: ProxyHandler<object> = {
  set: () => { throw new Refused(NO_REFS); },
  defineProperty: () => { throw new Refused(NO_REFS); },
  getOwnPropertyDescriptor: () => { throw new Refused(NO_REFS); },
  has: () => { throw new Refused(NO_REFS); },
};
const guarded = new WeakSet<object>();

/**
 * js-yaml calls this as it opens and closes each node. Each document gets a
 * fresh anchor table, swapped for one that refuses on the document's first
 * node, before any anchor can be read.
 */
function listener(event: EventType, loaderState: State): void {
  // The anchor table and the node's anchor are loader internals the typings leave out.
  const state = loaderState as State & { anchorMap?: object; anchor?: string | null };
  if (event === "open" && state.anchorMap && !guarded.has(state.anchorMap)) {
    state.anchorMap = new Proxy({}, NO_ANCHORS);
    guarded.add(state.anchorMap);
  }
  // Should js-yaml ever keep anchors somewhere else: a node closing with one still stops the read.
  if (event === "close" && state.anchor) throw new Refused(NO_REFS);
}

const READ: ParseOptions = { listener };

function isScalar(v: unknown): boolean {
  return v === undefined || v === null || ["string", "number", "boolean"].includes(typeof v) || v instanceof Date;
}

/** The file with its front matter left unread: the body as usual and `data` empty. */
function unread(text: string | Buffer): FrontMatterFile {
  const content = (Buffer.isBuffer(text) ? text.toString("utf8") : text).replace(/^﻿/, "");
  const opening = /^---(?!-)([^\r\n]*)/.exec(content);
  if (!opening) return { data: {}, language: "yaml", content };
  const rest = content.slice(opening[0].length);
  const closing = rest.indexOf("\n---");
  return {
    data: {}, language: opening[1]!.trim().toLowerCase() || "yaml",
    content: closing < 0 ? "" : rest.slice(closing + 4).replace(/^\r/, "").replace(/^\n/, ""),
  };
}

function parse(text: string | Buffer, opts: FrontMatterOptions = {}): FrontMatterFile {
  const skipped = unread(text);
  // Keep the markdown body, but never pass executable metadata to a parser.
  if (CODE_ENGINES.has(skipped.language)) return skipped;
  let file: FrontMatterFile;
  try {
    file = legacyMatter(text, READ);
  } catch (e) {
    if (e instanceof Refused) return { ...skipped, refused: e.message };
    throw e;
  }
  const listed = opts.scalars?.find((k) => !isScalar(file.data[k]));
  return listed ? { ...skipped, refused: `${listed} holds a list or a map where one value belongs` } : file;
}

/** Safe YAML/JSON parsing, with no anchors or aliases, and serialization; executable fences never run. */
export const matter = Object.assign(parse, {
  stringify: legacyMatter.stringify,
});

/**
 * The strings in `value` that fit on one line in at most `maxChars`, the
 * first `max` of them. Anything else in the list is dropped; a value that
 * isn't a list gives none.
 */
export function textList(value: unknown, max: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (out.length >= max) break;
    if (typeof v === "string" && v && v.length <= maxChars && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v)) out.push(v);
  }
  return out;
}

const warned = new Set<string>();

/**
 * Say once per process, on stderr, that `what` was skipped and why: one bad
 * file costs only itself, and whoever runs the command can find it.
 */
export function warnSkipped(what: string, place: string, why: string): void {
  const key = `${what}\u0000${place}`;
  if (warned.has(key)) return;
  warned.add(key);
  try {
    process.stderr.write(`⚠ skipped ${what} in ${JSON.stringify(place)}: ${why.replace(/\s+/g, " ").slice(0, 200)}\n`);
  } catch {
    /* nowhere to say it */
  }
}
