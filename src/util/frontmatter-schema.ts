/** Keep the safe scalar semantics of existing nodes while using js-yaml 4. */
import { DEFAULT_SCHEMA, Type, dump } from "js-yaml";

/* Legacy scalar rules adapted from js-yaml 3 under the MIT license:
 * Copyright (C) 2011-2015 by Vitaly Puzrin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

function legacyInteger(value: string | null): boolean {
  if (!value) return false;
  const unsigned = value.replace(/^[-+]/, "");
  if (unsigned === "0") return true;
  if (unsigned.startsWith("0b")) return /^0b[01_]*[01]$/.test(unsigned);
  if (unsigned.startsWith("0x")) return /^0x[0-9a-fA-F_]*[0-9a-fA-F]$/.test(unsigned);
  if (unsigned.startsWith("0")) return /^0[0-7_]*[0-7]$/.test(unsigned);
  return /^[1-9](?:[0-9_]*[0-9])?$/.test(unsigned)
    || /^[1-9][0-9_]*(?::[0-5]?[0-9])+$/.test(unsigned);
}

function base60(value: string, fractional: boolean): number {
  let result = 0;
  let base = 1;
  for (const part of value.split(":").reverse()) {
    result += (fractional ? Number.parseFloat(part) : Number.parseInt(part, 10)) * base;
    base *= 60;
  }
  return result;
}

function integerValue(raw: string): number {
  const value = raw.replace(/_/g, "");
  const sign = value.startsWith("-") ? -1 : 1;
  const unsigned = value.replace(/^[-+]/, "");
  if (unsigned === "0") return 0;
  if (unsigned.startsWith("0b")) return sign * Number.parseInt(unsigned.slice(2), 2);
  if (unsigned.startsWith("0x")) return sign * Number.parseInt(unsigned, 16);
  if (unsigned.startsWith("0")) return sign * Number.parseInt(unsigned, 8);
  return sign * (unsigned.includes(":") ? base60(unsigned, false) : Number.parseInt(unsigned, 10));
}

const FLOAT = /^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;

function floatValue(raw: string): number {
  const value = raw.replace(/_/g, "").toLowerCase();
  const sign = value.startsWith("-") ? -1 : 1;
  const unsigned = value.replace(/^[-+]/, "");
  if (unsigned === ".inf") return sign * Infinity;
  if (unsigned === ".nan") return NaN;
  return sign * (unsigned.includes(":") ? base60(unsigned, true) : Number.parseFloat(unsigned));
}

function isNumber(value: object): boolean {
  return Object.prototype.toString.call(value) === "[object Number]";
}

const integer = new Type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: legacyInteger,
  construct: integerValue,
  predicate: (value) => isNumber(value) && Number(value) % 1 === 0 && !Object.is(Number(value), -0),
  represent: (value) => dump(value).trim(),
});

const float = new Type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: (value: string | null) => value !== null && FLOAT.test(value) && !value.endsWith("_"),
  construct: floatValue,
  predicate: (value) => isNumber(value) && (Number(value) % 1 !== 0 || Object.is(Number(value), -0)),
  represent: (value) => dump(value).trim(),
});

const binary = new Type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: (value: string | null) => value !== null && /^[A-Za-z0-9+/=\r\n]*$/.test(value)
    && value.replace(/[\r\n]/g, "").length % 4 === 0,
  construct: (value: string) => {
    const raw = value.replace(/[\r\n=]/g, "");
    // Existing nodes used Buffer, including the old empty-binary representation.
    return raw.length === 0 ? Buffer.alloc(3) : Buffer.from(raw, "base64");
  },
  predicate: (value) => Buffer.isBuffer(value),
  represent: (value) => (value as Buffer).toString("base64"),
});

export const FRONTMATTER_SCHEMA = DEFAULT_SCHEMA.extend({ implicit: [integer, float], explicit: [binary] });
