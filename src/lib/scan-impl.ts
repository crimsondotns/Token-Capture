import type { CmcRow, DexRow, ScanResult, Source, SourcePref } from "./types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SLUG_ALIASES: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  usdt: "tether",
  usdc: "usd-coin",
  sol: "solana",
  bnb: "bnb",
  xrp: "xrp",
  doge: "dogecoin",
  ada: "cardano",
  avax: "avalanche",
  trx: "tron",
  ton: "toncoin",
  shib: "shiba-inu",
  pepe: "pepe",
  wif: "dogwifhat",
  bonk: "bonk",
  link: "chainlink",
  matic: "polygon",
  pol: "polygon-ecosystem-token",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

async function fetchOne(url: string, signal: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json,text/plain,*/*",
  };
  if (!isBrowser()) headers["user-agent"] = UA;
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    try {
      return await fetchOne(url, ctrl.signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Timed out waiting for the source");
      }
      if (!isBrowser() && !url.includes("io.dexscreener.com")) throw err;
      const proxied = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      return await fetchOne(proxied, ctrl.signal);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timed out waiting for the source");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function detectSource(query: string, preferred: SourcePref): Source {
  if (preferred !== "auto") return preferred;
  const q = query.trim();
  if (/dexscreener\.com/i.test(q)) return "dex";
  if (/coinmarketcap\.com/i.test(q)) return "cmc";
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) return "dex";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) && /[A-Z]/.test(q) && /[a-z]/.test(q)) {
    return "dex";
  }
  return "cmc";
}

function parseDexTarget(query: string): { chain: string; pair: string } | null {
  const details = query.match(/\/dex\/pair-details\/v\d+\/([^/?#]+)\/([^/?#]+)/i);
  if (details) return { chain: details[1], pair: details[2] };
  const bars = query.match(/\/dex\/chart\/.*?\/bars\/([^/?#]+)\/([^/?#]+)/i);
  if (bars) return { chain: bars[1], pair: bars[2] };
  try {
    const u = new URL(query);
    const m = u.pathname.match(/^\/([^/]+)\/([^/?#]+)/);
    if (m && /dexscreener\.com$/i.test(u.hostname.replace(/^www\./, ""))) {
      return { chain: m[1], pair: m[2] };
    }
  } catch {
    /* not a URL */
  }
  const m = query.trim().match(/^(?:https?:\/\/)?(?:www\.)?dexscreener\.com\/([^/]+)\/([^/?#]+)/i);
  return m ? { chain: m[1], pair: m[2] } : null;
}

function parseCmcTarget(query: string): { slug?: string; id?: string } {
  const raw = query.trim();
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/currencies\/([^/?#]+)/i);
    if (m) return { slug: decodeURIComponent(m[1]) };
  } catch {
    /* not a URL */
  }
  const path = raw.match(/\/currencies\/([^/?#]+)/i);
  if (path) return { slug: decodeURIComponent(path[1]) };
  if (/^\d+$/.test(raw)) return { id: raw };
  const cleaned = raw.replace(/^\$/, "").trim();
  const alias = SLUG_ALIASES[cleaned.toLowerCase()];
  return { slug: alias || cleaned.toLowerCase().replace(/\s+/g, "-") };
}

function formatDexId(p: Record<string, unknown>): string {
  const id = str(p.dexId);
  const labels = Array.isArray(p.labels) ? p.labels.map(str).filter(Boolean) : [];
  const version = labels.find((l) => /^v\d/i.test(l));
  if (version && id && !id.toLowerCase().replace(/\s+/g, "").includes(version.toLowerCase())) {
    return `${id}${version}`;
  }
  return id;
}

function dexRowFromPair(p: Record<string, unknown>): DexRow {
  const base = asRecord(p.baseToken) ?? {};
  const quote = asRecord(p.quoteToken) ?? {};
  const info = asRecord(p.info) ?? {};
  const chain = str(p.chainId);
  const pool = str(p.pairAddress);
  return {
    kind: "dex",
    symbol: str(base.symbol),
    chain,
    dexId: formatDexId(p),
    quote: str(quote.address) || str(quote.symbol),
    contract: str(base.address),
    poolAddress: pool,
    url: str(p.url) || (chain && pool ? `https://dexscreener.com/${chain}/${pool}` : ""),
    imageUrl: str(info.imageUrl),
    priceUsd: str(p.priceUsd),
    supply: "",
    totalSupply: "",
  };
}

function firstPositive(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return v.trim();
    }
  }
  return "";
}

function supplyFromDetails(root: unknown): { circulating: string; total: string } {
  const rec = asRecord(root) ?? {};
  const su = asRecord(rec.su) ?? {};
  const gp = asRecord(rec.gp) ?? {};
  const cmc = asRecord(rec.cmc) ?? {};
  const cg = asRecord(rec.cg) ?? {};
  const qi = asRecord(rec.qi) ?? {};
  const tokenDetails = asRecord(qi.tokenDetails) ?? {};
  return {
    circulating: firstPositive(
      su.circulatingSupply,
      cmc.selfReportedCirculatingSupply,
      cg.circulatingSupply,
    ),
    total: firstPositive(gp.totalSupply, tokenDetails.tokenSupply, su.totalSupply, cg.totalSupply),
  };
}

function supplyFromPair(p: Record<string, unknown>): { circulating: string; total: string } {
  const price = num(p.priceUsd);
  const mcap = num(p.marketCap);
  const fdv = num(p.fdv);
  return {
    circulating: price && price > 0 && mcap != null ? String(mcap / price) : "",
    total: price && price > 0 && fdv != null ? String(fdv / price) : "",
  };
}

function parseDetailsBody(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const rec = asRecord(JSON.parse(raw.slice(start, end + 1)));
    if (rec && (rec.su || rec.gp || rec.qi || rec.cmc || rec.cg)) return rec;
  } catch {
    return null;
  }
  return null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { accept: "application/json,text/plain,*/*" };
    if (!isBrowser()) headers["user-agent"] = UA;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPairDetails(chain: string, pool: string): Promise<Record<string, unknown> | null> {
  const path = `/dex/pair-details/v4/${encodeURIComponent(chain)}/${encodeURIComponent(pool)}`;
  const urls = [
    `https://io.dexscreener.com${path}`,
    `https://r.jina.ai/http://io.dexscreener.com${path}`,
    `https://r.jina.ai/https://io.dexscreener.com${path}`,
  ];
  for (const url of urls) {
    try {
      const rec = parseDetailsBody(await fetchText(url, 10000));
      if (rec) return rec;
    } catch {
      /* try the next host */
    }
  }
  return null;
}

function dexRowFromDetails(
  target: { chain: string; pair: string },
  details: Record<string, unknown>,
): DexRow {
  const cms = asRecord(details.cms) ?? {};
  const cmc = asRecord(details.cmc) ?? {};
  const qi = asRecord(details.qi) ?? {};
  const td = asRecord(qi.tokenDetails) ?? {};
  const gp = asRecord(details.gp) ?? {};
  const dexes = Array.isArray(gp.dex) ? gp.dex : [];
  const firstDex = asRecord(dexes[0]) ?? {};
  const supply = supplyFromDetails(details);
  const circulating = supply.circulating || supply.total;
  return {
    kind: "dex",
    symbol: str(cms.symbol) || str(cmc.symbol) || str(td.tokenSymbol),
    chain: str(cms.chainId) || target.chain,
    dexId: str(firstDex.name),
    quote: "",
    contract: str(cms.address) || str(qi.tokenAddress),
    poolAddress: target.pair,
    url: `https://dexscreener.com/${target.chain}/${target.pair}`,
    imageUrl: str(cmc.logo),
    priceUsd: "",
    supply: circulating,
    totalSupply: supply.total && supply.total !== circulating ? supply.total : "",
  };
}

async function fillSupply(rows: DexRow[], pairs: Record<string, unknown>[]): Promise<void> {
  const cap = Math.min(rows.length, 12);
  let cursor = 0;
  const worker = async () => {
    while (cursor < cap) {
      const i = cursor++;
      const row = rows[i];
      const pair = pairs[i] ?? {};
      const fallback = supplyFromPair(pair);
      let details = { circulating: "", total: "" };
      try {
        const body = await fetchPairDetails(row.chain, row.poolAddress);
        if (body) details = supplyFromDetails(body);
      } catch {
        /* keep fallback */
      }
      const circulating = details.circulating || fallback.circulating;
      const total = details.total || fallback.total;
      row.supply = circulating || total;
      row.totalSupply = total && total !== row.supply ? total : "";
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, cap) }, () => worker()));
  for (let i = cap; i < rows.length; i++) {
    const fallback = supplyFromPair(pairs[i] ?? {});
    rows[i].supply = fallback.circulating || fallback.total;
    rows[i].totalSupply = fallback.total && fallback.total !== rows[i].supply ? fallback.total : "";
  }
}

async function scanDex(query: string): Promise<ScanResult> {
  const target = parseDexTarget(query);
  let pairs: Record<string, unknown>[] = [];

  if (target) {
    try {
      const data = asRecord(
        await fetchJson(
          `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(target.chain)}/${encodeURIComponent(target.pair)}`,
        ),
      );
      const list = data?.pairs;
      const single = asRecord(data?.pair);
      if (Array.isArray(list)) {
        pairs = list.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x);
      } else if (single) {
        pairs = [single];
      }
    } catch {
      pairs = [];
    }
  } else {
    const data = asRecord(
      await fetchJson(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      ),
    );
    const list = data?.pairs;
    if (Array.isArray(list)) {
      pairs = list.map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x);
    }
    if (!pairs.length) {
      throw new Error(`DexScreener found no pools for “${query}”.`);
    }
  }

  pairs.sort((a, b) => {
    const liq = (p: Record<string, unknown>) => {
      const l = asRecord(p.liquidity);
      return num(l?.usd) ?? 0;
    };
    return liq(b) - liq(a);
  });

  const rows = pairs.map(dexRowFromPair);
  await fillSupply(rows, pairs);

  if (!rows.length && target) {
    const details = await fetchPairDetails(target.chain, target.pair);
    if (details) rows.push(dexRowFromDetails(target, details));
  }
  if (!rows.length) {
    throw new Error(
      target
        ? `No pool at ${target.chain}/${target.pair}. Check the URL, or search by token symbol.`
        : `DexScreener found no pools for “${query}”.`,
    );
  }

  const first = rows[0];
  return {
    ok: true,
    source: "dex",
    query,
    title: target
      ? `${first?.symbol || "Pool"} · ${target.chain}`
      : `Search · ${query}`,
    subtitle: target
      ? `${rows.length} pool${rows.length === 1 ? "" : "s"} on this page`
      : `${rows.length} pool${rows.length === 1 ? "" : "s"} matching “${query}”`,
    rows,
  };
}

type CmcPlatform = {
  contractAddress?: unknown;
  contractPlatform?: unknown;
  contractPlatformId?: unknown;
  tokenAddress?: unknown;
  platformName?: unknown;
  platformId?: unknown;
};

async function scanCmc(query: string): Promise<ScanResult> {
  const target = parseCmcTarget(query);
  const param = target.id
    ? `id=${encodeURIComponent(target.id)}`
    : `slug=${encodeURIComponent(target.slug || query)}`;
  let data: Record<string, unknown> | null = null;
  try {
    const body = asRecord(
      await fetchJson(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?${param}`),
    );
    data = asRecord(body?.data);
  } catch {
    data = null;
  }
  if (!data) {
    const hint = target.slug || target.id || query;
    throw new Error(
      `No CoinMarketCap coin for “${hint}”. Use a /currencies/… URL or a slug such as bitcoin, tether, solana.`,
    );
  }

  const id = num(data.id);
  const symbol = str(data.symbol);
  const slug = str(data.slug);
  const platforms = Array.isArray(data.platforms) ? data.platforms : [];

  const rows: CmcRow[] = [];
  for (const item of platforms) {
    const p = asRecord(item) as CmcPlatform | null;
    if (!p) continue;
    const tokenAddress = str(p.contractAddress) || str(p.tokenAddress);
    if (!tokenAddress) continue;
    rows.push({
      kind: "cmc",
      avatar: "",
      symbol,
      slug,
      id,
      platformId: num(p.contractPlatformId) ?? num(p.platformId),
      platformName: str(p.contractPlatform) || str(p.platformName),
      tokenAddress,
    });
  }

  if (!rows.length) {
    rows.push({
      kind: "cmc",
      avatar: "",
      symbol,
      slug,
      id,
      platformId: null,
      platformName: "",
      tokenAddress: "",
    });
  }

  return {
    ok: true,
    source: "cmc",
    query,
    title: `${symbol || slug} · #${id ?? "—"}`,
    subtitle: `${rows.length} contract${rows.length === 1 ? "" : "s"} · ${slug}`,
    rows,
  };
}

export async function performScan(input: {
  query: string;
  source: SourcePref;
}): Promise<ScanResult> {
  const query = input.query.trim();
  if (!query) {
    return { ok: false, error: "Paste a URL, slug, or symbol first — then press Scan." };
  }
  const source = detectSource(query, input.source);
  try {
    return source === "dex" ? await scanDex(query) : await scanCmc(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return { ok: false, error: message };
  }
}
