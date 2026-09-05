import type { ScanOk, Source } from "./types";

const KEY = "xcap-history-v1";
const LIMIT = 12;

export type HistoryEntry = {
  /** Exactly what was scanned, so replaying it is not a re-derivation. */
  query: string;
  source: Source;
  /** What to put on the chip: the pair, as BASE/QUOTE, once it is known. */
  label: string;
  /** The chain the token lives on - ChainID, or CMC's platform name. */
  detail: string;
  at: number;
};

// A pool is a pair, so the chip says so: TROLL/SOL. The quote's ticker only
// comes from the public pairs API, so a row built from pair-details alone
// falls back to the base symbol on its own.
function pairLabel(row: ScanOk["rows"][number] | undefined): string {
  if (!row) return "";
  if (row.kind !== "dex") return row.symbol;
  return row.quoteSymbol ? `${row.symbol}/${row.quoteSymbol}` : row.symbol;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e && typeof e.query === "string" && typeof e.label === "string",
    );
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode, or a full quota: history is not worth failing a scan for */
  }
}

/**
 * The same pool scanned twice is one entry, moved back to the front rather
 * than repeated - a history that fills up with one address is not a history.
 */
export function rememberScan(
  query: string,
  source: Source,
  result: ScanOk,
): HistoryEntry[] {
  const row = result.rows[0];
  const entry: HistoryEntry = {
    query: query.trim(),
    source,
    label: pairLabel(row) || query.trim(),
    detail: row ? (row.kind === "dex" ? row.chain : row.platformName) : "",
    at: Date.now(),
  };
  if (!entry.query) return loadHistory();

  const key = entry.query.toLowerCase();
  const next = [entry, ...loadHistory().filter((e) => e.query.toLowerCase() !== key)].slice(
    0,
    LIMIT,
  );
  save(next);
  return next;
}

export function forgetScan(query: string): HistoryEntry[] {
  const key = query.trim().toLowerCase();
  const next = loadHistory().filter((e) => e.query.toLowerCase() !== key);
  save(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  save([]);
  return [];
}
