import type { CmcRow, DexRow, ScanRow, Settings } from "./types";
import { CMC_COLUMNS, DEX_COLUMNS } from "./types";

export function presentRow(row: ScanRow, settings: Settings): ScanRow {
  if (row.kind !== "cmc") return row;
  const next: CmcRow = { ...row };
  if (settings.deriveAvatar && !next.avatar && next.id != null) {
    next.avatar = `https://s2.coinmarketcap.com/static/img/coins/64x64/${next.id}.png`;
  }
  if (settings.nativeAsUcid && !next.tokenAddress && next.id != null) {
    next.platformName = next.platformName || next.symbol;
    next.tokenAddress = `UCID=${next.id}`;
  }
  return next;
}

export function tsvOf(row: ScanRow): string {
  if (row.kind === "dex") {
    return [row.symbol, row.chain, row.dexId, row.quote, row.contract, row.poolAddress].join("\t");
  }
  return [
    row.avatar,
    row.symbol,
    row.slug,
    row.id ?? "",
    row.platformId ?? "",
    row.platformName,
    row.tokenAddress,
  ].join("\t");
}

export function jsonOf(row: ScanRow): Record<string, unknown> {
  if (row.kind === "dex") {
    return {
      symbol: row.symbol || null,
      chain: row.chain,
      contractAddress: row.contract || null,
      protocol: row.dexId,
      poolAddress: row.poolAddress,
      quoteToken: row.quote,
    };
  }
  return {
    avatar: row.avatar || null,
    symbol: row.symbol,
    slug: row.slug,
    id: row.id,
    platformId: row.platformId,
    platformName: row.platformName || null,
    tokenAddress: row.tokenAddress || null,
  };
}

export function columnsOf(rows: ScanRow[]): readonly string[] {
  return rows[0]?.kind === "cmc" ? CMC_COLUMNS : DEX_COLUMNS;
}

export function searchFields(row: ScanRow): Record<string, string> {
  if (row.kind === "dex") {
    return {
      symbol: row.symbol.toLowerCase(),
      chain: row.chain.toLowerCase(),
      dexid: row.dexId.toLowerCase(),
      quote: row.quote.toLowerCase(),
      contract: row.contract.toLowerCase(),
      pool: row.poolAddress.toLowerCase(),
    };
  }
  return {
    symbol: row.symbol.toLowerCase(),
    slug: row.slug.toLowerCase(),
    id: row.id == null ? "" : String(row.id),
    chain: row.platformName.toLowerCase(),
    platformid: row.platformId == null ? "" : String(row.platformId),
    contract: row.tokenAddress.toLowerCase(),
  };
}

const ALIASES: Record<string, string> = {
  sym: "symbol",
  ticker: "symbol",
  name: "symbol",
  s: "slug",
  ucid: "id",
  cid: "id",
  chain: "chain",
  platform: "chain",
  net: "chain",
  pid: "platformid",
  addr: "contract",
  address: "contract",
  ca: "contract",
  dex: "dexid",
  protocol: "dexid",
  dexid: "dexid",
  pool: "pool",
  pair: "pool",
  quote: "quote",
  q: "quote",
};

const EXACT: Record<string, boolean> = { id: true, platformid: true };

export function matchQuery(text: string, row: ScanRow): boolean {
  const terms = text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const colon = term.indexOf(":");
      return colon > 0
        ? { key: term.slice(0, colon), value: term.slice(colon + 1) }
        : { key: null as string | null, value: term };
    })
    .filter((t) => t.value);
  if (!terms.length) return true;
  const fields = searchFields(row);
  return terms.every((term) => {
    const hit = (key: string, value: string) => {
      const field = fields[key];
      if (field == null) return false;
      if (EXACT[key] && /^\d+$/.test(value)) return field === value;
      return field.includes(value);
    };
    if (!term.key) {
      return Object.keys(fields).some((key) => hit(key, term.value));
    }
    const key = ALIASES[term.key] || term.key;
    if (!(key in fields)) return false;
    return hit(key, term.value);
  });
}

export function isDex(row: ScanRow): row is DexRow {
  return row.kind === "dex";
}

export function isCmc(row: ScanRow): row is CmcRow {
  return row.kind === "cmc";
}
