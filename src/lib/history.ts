import type { ScanOk, Source } from "./types";

const KEY = "xcap-history-v1";
const LIMIT = 12;

export type HistoryEntry = {
  /** Exactly what was scanned, so replaying it is not a re-derivation. */
  query: string;
  source: Source;
  /** What to put on the chip: the token's symbol once it is known. */
  label: string;
  /** Chain or platform, for the second line. */
  detail: string;
  at: number;
};

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
    label: row?.symbol || query.trim(),
    detail: row
      ? row.kind === "dex"
        ? [row.dexId, row.chain].filter(Boolean).join(" · ")
        : row.platformName || row.slug
      : "",
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
