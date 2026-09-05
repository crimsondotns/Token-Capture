import type { CmcRow } from "./types";

/**
 * CoinMarketCap renders server-side, so a coin's contracts are already in the
 * page source - which is the same thing the extension's content script reads,
 * and it needs no API at all. The API is the fragile half of this: it answers
 * only to its own origin, so a browser build has to borrow a proxy, and its
 * slug lookup fails outright for a coin whose slug is not the symbol.
 *
 * The shape is undocumented and changes, so nothing here knows a path: it
 * finds every JSON object in the text that carries a contract, and reads what
 * that object and its enclosing coin happen to name.
 */

const ADDRESS_KEYS = ["tokenAddress", "contractAddress"] as const;
const PLATFORM_ID_KEYS = ["platformId", "contractPlatformId"] as const;
const PLATFORM_NAME_KEYS = ["platformName", "contractPlatform"] as const;

const MAX_OBJECT = 400_000; // longest object worth trying to parse
const MAX_HITS = 4_000;

type Obj = Record<string, unknown>;

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const str = (v: unknown): string => (isStr(v) ? v.trim() : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : isStr(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const pickStr = (o: Obj, keys: readonly string[]): string => {
  for (const k of keys) if (isStr(o[k])) return str(o[k]);
  return "";
};
const pickNum = (o: Obj, keys: readonly string[]): number | null => {
  for (const k of keys) {
    const n = num(o[k]);
    if (n != null) return n;
  }
  return null;
};

// Positions of every occurrence, so the brace scanner can ask "does any
// occurrence fall inside this object?" without re-scanning the slice - the
// difference between linear and quadratic on a page this size.
function positionsOf(text: string, needle: string): number[] {
  const at: number[] = [];
  let i = -1;
  while ((i = text.indexOf(needle, i + 1)) !== -1) {
    at.push(i);
    if (at.length > MAX_HITS) break;
  }
  return at;
}

function anyInRange(sorted: number[], lo: number, hi: number): boolean {
  let a = 0;
  let b = sorted.length - 1;
  while (a <= b) {
    const mid = (a + b) >> 1;
    if (sorted[mid] < lo) a = mid + 1;
    else if (sorted[mid] > hi) b = mid - 1;
    else return true;
  }
  return false;
}

/**
 * Every JSON object in the text containing the key. Objects close
 * innermost-first, so a contract record arrives before the coin object
 * wrapping it, and both are kept: one names the contract, the other carries
 * the symbol.
 */
function scanObjects(text: string, key: string): Obj[] {
  const at = positionsOf(text, `"${key}"`);
  if (!at.length) return [];

  const out: Obj[] = [];
  const stack: number[] = [];
  let inStr = false;
  let esc = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") {
      stack.push(i);
      continue;
    }
    if (c !== "}") continue;

    const start = stack.pop();
    if (start === undefined) continue;
    if (i - start > MAX_OBJECT) continue;
    if (!anyInRange(at, start, i)) continue;
    try {
      const o = JSON.parse(text.slice(start, i + 1));
      if (o && typeof o === "object" && !Array.isArray(o)) out.push(o as Obj);
    } catch {
      /* a fragment, not a whole object */
    }
    if (out.length > 2000) break;
  }
  return out;
}

/**
 * The App Router ships its payload inside JS string literals, so the keys
 * only ever appear escaped. Each literal is pulled out and decoded properly:
 * a blanket replace of \" leaves every quote ambiguous, and the brace scanner
 * then reads the payload's opening { as part of a string and finds nothing.
 */
function decodedLiterals(text: string): string[] {
  const needles = [...ADDRESS_KEYS, "slug"].map((n) => `\\"${n}\\"`);
  if (!needles.some((n) => text.includes(n))) return [];

  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    let j = i + 1;
    let esc = false;
    for (; j < text.length; j++) {
      const c = text[j];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') break;
    }
    if (j >= text.length) break;
    const literal = text.slice(i, j + 1);
    i = j;
    if (!needles.some((n) => literal.includes(n))) continue;
    try {
      const decoded = JSON.parse(literal);
      if (typeof decoded === "string") out.push(decoded);
    } catch {
      /* not a JSON-compatible literal */
    }
    if (out.length > 60) break;
  }
  return out;
}

/** A contract keyed by address and chain: the same address really can exist
 *  on several chains, so those stay separate rows. */
function keyOf(row: CmcRow): string {
  return `${row.tokenAddress.toLowerCase()}|${row.platformId ?? row.platformName}`;
}

function rowFrom(contract: Obj, coin: Obj | null): CmcRow {
  const own = (a: string, b: string) => a || b;
  return {
    kind: "cmc",
    avatar: "",
    symbol: own(str(contract.symbol), coin ? str(coin.symbol) : ""),
    slug: own(str(contract.slug), coin ? str(coin.slug) : ""),
    id: num(contract.id) ?? (coin ? num(coin.id) : null),
    platformId: pickNum(contract, PLATFORM_ID_KEYS),
    platformName: pickStr(contract, PLATFORM_NAME_KEYS),
    tokenAddress: pickStr(contract, ADDRESS_KEYS),
  };
}

/**
 * Contracts found in a coin page's own source. `slug` narrows the result to
 * the coin being looked at - a coin page embeds its sidebars and tables too,
 * and those are other people's coins.
 */
export function rowsFromCmcPage(html: string, slug: string): CmcRow[] {
  if (!html || html.length < 200) return [];

  const texts = [html, ...decodedLiterals(html)];
  const byKey = new Map<string, CmcRow>();
  const wanted = slug.trim().toLowerCase();

  for (const text of texts) {
    for (const key of ADDRESS_KEYS) {
      for (const obj of scanObjects(text, key)) {
        if (!pickStr(obj, ADDRESS_KEYS)) continue;
        const row = rowFrom(obj, null);
        // The contract record rarely names its own coin, so an object that
        // wraps one - the coin - fills the symbol and slug back in.
        if (!row.symbol || !row.slug) {
          const parent = scanObjects(text, "slug").find((c) =>
            JSON.stringify(c).includes(row.tokenAddress),
          );
          if (parent) {
            row.symbol ||= str(parent.symbol);
            row.slug ||= str(parent.slug);
            row.id ??= num(parent.id);
          }
        }
        if (!row.tokenAddress) continue;
        if (wanted && row.slug && row.slug.toLowerCase() !== wanted) continue;
        const k = keyOf(row);
        const prev = byKey.get(k);
        byKey.set(
          k,
          prev
            ? {
                ...prev,
                symbol: prev.symbol || row.symbol,
                slug: prev.slug || row.slug,
                id: prev.id ?? row.id,
                platformName: prev.platformName || row.platformName,
                platformId: prev.platformId ?? row.platformId,
              }
            : row,
        );
      }
    }
  }
  return [...byKey.values()];
}
