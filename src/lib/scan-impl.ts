import { rowsFromCmcPage } from "./cmc-page";
import type { CmcRow, DexRow, ScanOk, ScanResult, Source, SourcePref } from "./types";

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

// A scan fans out into dozens of requests across several hosts, and the only
// handle the UI has on it is performScan's promise. Rather than thread a
// signal through every helper, the running scan owns one controller and the
// two fetch wrappers below join it to their own timeout.
let activeScan: AbortController | null = null;

export function cancelScan(): void {
  activeScan?.abort(new DOMException("Scan cancelled", "AbortError"));
}

// AbortSignal.any is what lets a request die from either its own timeout or
// the scan being cancelled; without it the two would have to be polled.
function scanSignal(own: AbortSignal): AbortSignal {
  const scan = activeScan?.signal;
  if (!scan) return own;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([own, scan]);
  return scan.aborted ? scan : own;
}

/**
 * JSON over the same ladder of attempts as fetchText, so an API that refuses
 * this origin - or a proxy that refuses this network - is one failure among
 * several rather than the end of the scan.
 */
async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const body = await fetchText(url, timeoutMs);
  try {
    return JSON.parse(body);
  } catch {
    /* a reader proxy can wrap the payload in a line or two of its own */
  }
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      /* not JSON after all */
    }
  }
  throw new Error("The source did not answer with JSON");
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
  if (/dexscreener\.com/i.test(q) || /io\.dexscreener\.com/i.test(q)) return "dex";
  if (/coinmarketcap\.com/i.test(q)) return "cmc";
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) return "dex";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) && /[A-Z]/.test(q) && /[a-z]/.test(q)) {
    return "dex";
  }
  return "cmc";
}

type DexTarget = { chain: string; pair: string; dexId?: string; quote?: string };

function queryParam(raw: string, key: string): string {
  try {
    return new URL(raw).searchParams.get(key) || "";
  } catch {
    const m = raw.match(new RegExp(`[?&]${key}=([^&]*)`, "i"));
    return m ? decodeURIComponent(m[1]) : "";
  }
}

export function parseDexTarget(query: string): DexTarget | null {
  const details = query.match(/\/dex\/pair-details\/v\d+\/([^/?#]+)\/([^/?#]+)/i);
  if (details) return { chain: details[1], pair: details[2] };
  const bars = query.match(/\/dex\/chart\/.*?\/([^/]+)\/bars\/([^/?#]+)\/([^/?#]+)/i);
  if (bars) {
    return {
      dexId: bars[1],
      chain: bars[2],
      pair: bars[3],
      quote: queryParam(query, "q"),
    };
  }
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

// ---- DexID without the extension ---------------------------------------
//
// io.dexscreener charts a pool at /dex/chart/amm/v3/{dexId}/bars/{chain}/{pool},
// and that {dexId} is its own adapter name, which the public API does not
// report: the API says meteora where the chart says solamm, ramsesv3 where the
// chart says uniswap. Capturing the URL needs a browser extension hooking the
// chart Worker, so instead the candidates are tried against the endpoint and
// the one that answers with bars is the real name.

/** Univ3 forks all chart under the uniswap adapter. */
const UNISWAP_V3_ADAPTERS = new Set([
  "uniswap", "ramses", "nile", "pharaoh", "cleopatra", "aerodrome", "velodrome",
  "thruster", "camelot", "lynex", "swapx", "alienbase", "baseswap", "quickswap",
  "sushiswap", "sushi", "spookyswap", "equalizer", "thena", "fusionx", "agni",
  "thick", "kim", "hercules", "sparkdex", "kodiak", "superswap", "dackieswap",
  "swapr", "zyberswap", "horizon", "swapbased",
]);

// Names the API reports, against the adapter the chart URL uses. Every entry
// here has been read off a real /dex/chart/amm/v3/{adapter}/bars/ request -
// a guessed one is worse than an empty column, because it looks right.
//   meteora  -> DdMA1cHc… charts at /amm/v3/solamm/
//   pumpswap -> CV2m2hK9… charts at /amm/v3/pumpfundex/
const ADAPTER_ALIASES: Record<string, string[]> = {
  meteora: ["solamm", "meteora"],
  pumpswap: ["pumpfundex", "pumpswap"],
  pumpfun: ["pumpfundex", "pumpfun"],
};

function normalizeDexId(raw: string): string {
  return raw.toLowerCase().replace(/[\s_-]+/g, "");
}

/** Ordered guesses at the chart adapter name, best first. */
export function chartDexCandidates(p: Record<string, unknown>): string[] {
  const raw = normalizeDexId(str(p.dexId));
  if (!raw) return [];
  const labels = Array.isArray(p.labels) ? p.labels.map(str).map((s) => s.toLowerCase()) : [];
  const base = raw.replace(/v[2-4]$/, "");
  const isV4 = labels.includes("v4") || raw.endsWith("v4");

  const out: string[] = [];
  if (UNISWAP_V3_ADAPTERS.has(base) || UNISWAP_V3_ADAPTERS.has(raw)) {
    out.push(isV4 ? "uniswapv4" : "uniswap");
  }
  out.push(...(ADAPTER_ALIASES[base] ?? []));
  out.push(raw, base);
  const version = labels.find((l) => /^v\d/.test(l));
  if (version && !raw.includes(version)) out.push(base + version);
  return [...new Set(out.filter(Boolean))];
}

// A wrong adapter name is refused outright; the right one answers with a
// protobuf body, which is binary and never short.
async function chartDexAnswers(
  dexId: string,
  chain: string,
  pool: string,
  quote: string,
): Promise<boolean> {
  const path =
    `/dex/chart/amm/v3/${encodeURIComponent(dexId)}/bars/${encodeURIComponent(chain)}/${encodeURIComponent(pool)}` +
    `?res=1440&cb=2&q=${encodeURIComponent(quote)}`;
  const urls = isBrowser()
    ? [`https://io.dexscreener.com${path}`]
    : [`https://io.dexscreener.com${path}`, `https://r.jina.ai/http://io.dexscreener.com${path}`];
  for (const url of urls) {
    try {
      const body = await fetchText(url, 8000);
      if (body && body.length > 250 && !/cannot get|not found/i.test(body.slice(0, 200))) {
        return true;
      }
    } catch {
      /* a refusal is an answer too: this name is not the one */
    }
  }
  return false;
}

async function resolveChartDexId(
  pair: Record<string, unknown>,
  chain: string,
  pool: string,
  quote: string,
): Promise<string> {
  // Four round trips is already slow enough to notice; past that the guess
  // is not worth the wait.
  const candidates = chartDexCandidates(pair).slice(0, 4);
  for (const id of candidates) {
    if (await chartDexAnswers(id, chain, pool, quote)) return id;
  }
  // Cloudflare can refuse every probe, which says nothing about which name is
  // right. A curated mapping is still a better answer than an empty column;
  // an uncurated guess is not, so those stay blank.
  const raw = normalizeDexId(str(pair.dexId));
  const base = raw.replace(/v[2-4]$/, "");
  const curated =
    ADAPTER_ALIASES[base] !== undefined ||
    UNISWAP_V3_ADAPTERS.has(base) ||
    UNISWAP_V3_ADAPTERS.has(raw);
  return curated ? (candidates[0] ?? "") : "";
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
    name: str(base.name),
    chain,
    // The public API's dexId is a different name for the same pool
    // (ramsesv3 where io.dexscreener says uniswap), so it is left blank
    // and filled from io.dexscreener instead.
    dexId: "",
    quote: str(quote.address) || str(quote.symbol),
    quoteSymbol: str(quote.symbol),
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
  return {
    circulating: firstPositive(
      su.circulatingSupply,
      cmc.selfReportedCirculatingSupply,
      cg.circulatingSupply,
    ),
    // Quick Intel tokenSupply and GoPlus lpTotalSupply are not the
    // DexScreener tooltip figures — ignore them.
    total: firstPositive(su.totalSupply, gp.totalSupply, cg.totalSupply, cg.maxSupply),
  };
}

function supplyFromPair(p: Record<string, unknown>): { circulating: string; total: string } {
  const price = num(p.priceUsd);
  const mcap = num(p.marketCap);
  return {
    circulating: price && price > 0 && mcap != null ? String(mcap / price) : "",
    total: "",
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function cmcSupplyForToken(symbol: string, name: string, contract: string): Promise<{ circulating: string; total: string }> {
  const needle = contract.toLowerCase();
  const slugs = [...new Set([slugify(name), slugify(symbol), SLUG_ALIASES[symbol.toLowerCase()] || ""])].filter(
    (s) => s.length > 1,
  );
  for (const slug of slugs) {
    try {
      const body = asRecord(
        await fetchJson(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?slug=${encodeURIComponent(slug)}`),
      );
      const data = asRecord(body?.data);
      if (!data) continue;
      if (needle.length >= 8 && !JSON.stringify(data).toLowerCase().includes(needle)) continue;
      const st = asRecord(data.statistics) ?? {};
      return {
        circulating: firstPositive(
          data.selfReportedCirculatingSupply,
          st.selfReportedCirculatingSupply,
          st.circulatingSupply,
        ),
        total: firstPositive(st.totalSupply),
      };
    } catch {
      /* next slug */
    }
  }
  return { circulating: "", total: "" };
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

// Tried in order when a host refuses the page's own origin. None of them is
// reliable on its own: each is a free service that rate-limits, blocks whole
// networks, or disappears.
const CORS_PROXIES: ((url: string) => string)[] = [
  // First because it is the one that answers: measured from the Pages build,
  // r.jina.ai returned CoinMarketCap's JSON in 0.6s while allorigins and
  // codetabs hung to their timeout and corsproxy answered 403. It takes the
  // target URL unencoded, appended to its own path.
  (u) => `https://r.jina.ai/${u}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

const isProxied = (url: string) =>
  /corsproxy\.io|allorigins\.win|codetabs\.com|r\.jina\.ai/i.test(url);

async function fetchTextOnce(url: string, timeoutMs: number): Promise<string> {
  // Its own timer per attempt: a shared one lets the first slow proxy spend
  // the whole budget, and the rest never get a turn.
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException("Timed out waiting for the source", "AbortError")),
    timeoutMs,
  );
  try {
    const headers: Record<string, string> = { accept: "application/json,text/plain,*/*" };
    if (!isBrowser() && !/r\.jina\.ai/i.test(url)) headers["user-agent"] = UA;
    const res = await fetch(url, { signal: scanSignal(ctrl.signal), headers });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The direct request first, then every proxy in turn. io.dexscreener and
 * coinmarketcap both answer only to their own origin, so a browser build has
 * to borrow one, and each of the free proxies fails somewhere: 403 on a whole
 * network, a rate limit, or simply being slow enough to time out.
 */
async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const attempts = [
    url,
    ...(isBrowser() && !isProxied(url) ? CORS_PROXIES.map((p) => p(url)) : []),
  ];
  let last: unknown = new Error("Request failed");
  for (const attempt of attempts) {
    try {
      return await fetchTextOnce(attempt, timeoutMs);
    } catch (err) {
      // A cancelled scan ends everything; one attempt timing out only ends
      // that attempt.
      if (activeScan?.signal.aborted) throw err;
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Request failed");
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
      const raw = await fetchText(url, 10000);
      const rec = parseDetailsBody(raw);
      if (rec) return rec;
    } catch {
      /* try the next host */
    }
  }
  return null;
}

// io.dexscreener's pair-details payload carries the DexID the site itself
// shows, but the key has moved around between schema versions, so it is found
// by name rather than by a hardcoded path. Breadth-first: the shallowest
// dexId wins, which is the pair's own rather than a nested related pair's.
export function dexIdFromDetails(root: unknown): string {
  const queue: unknown[] = [root];
  let steps = 0;
  while (queue.length && steps++ < 5000) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      for (const v of node) if (v && typeof v === "object") queue.push(v);
      continue;
    }
    const rec = asRecord(node);
    if (!rec) continue;
    for (const [k, v] of Object.entries(rec)) {
      if (/^dex_?id$/i.test(k)) {
        const id = str(v).toLowerCase();
        // an address here means the key is something else entirely
        if (id && id.length <= 40 && !/^0x/.test(id) && /^[a-z0-9][a-z0-9._-]*$/.test(id)) {
          return id;
        }
      }
    }
    for (const v of Object.values(rec)) if (v && typeof v === "object") queue.push(v);
  }
  return "";
}

function dexRowFromDetails(target: DexTarget, details: Record<string, unknown>): DexRow {
  const cms = asRecord(details.cms) ?? {};
  const cmc = asRecord(details.cmc) ?? {};
  const qi = asRecord(details.qi) ?? {};
  const td = asRecord(qi.tokenDetails) ?? {};
  const supply = supplyFromDetails(details);
  const circulating = supply.circulating || supply.total;
  return {
    kind: "dex",
    symbol: str(cms.symbol) || str(cmc.symbol) || str(td.tokenSymbol),
    name: str(cms.name) || str(cmc.name) || str(td.tokenName),
    chain: str(cms.chainId) || target.chain,
    dexId: target.dexId || dexIdFromDetails(details),
    quote: target.quote || "",
    // pair-details names the base token, never the quote.
    quoteSymbol: "",
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
        if (body) {
          details = supplyFromDetails(body);
          // The chart URL, when one was pasted, has already set this.
          if (!row.dexId) row.dexId = dexIdFromDetails(body);
        }
      } catch {
        /* keep fallback */
      }
      let fromCmc = { circulating: "", total: "" };
      if (!details.total || !details.circulating) {
        try {
          fromCmc = await cmcSupplyForToken(row.symbol, row.name, row.contract);
        } catch {
          /* ignore */
        }
      }
      const circulating = details.circulating || fromCmc.circulating || fallback.circulating;
      const total = details.total || fromCmc.total;
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
  if (target?.dexId) {
    const pool = target.pair.toLowerCase();
    for (const row of rows) {
      if (!row.poolAddress || row.poolAddress.toLowerCase() === pool) {
        row.dexId = target.dexId;
        if (target.quote) row.quote = target.quote;
      }
    }
  } else if (rows[0] && pairs[0]) {
    // Only the pool actually being looked at: probing every row would mean
    // dozens of requests for a column read one row at a time.
    rows[0].dexId = await resolveChartDexId(
      pairs[0],
      rows[0].chain,
      rows[0].poolAddress,
      rows[0].quote,
    );
  }
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

/**
 * `unreachable` is the difference between "CoinMarketCap says there is no
 * such coin" and "nothing could reach CoinMarketCap at all" - two failures
 * that want completely different things from the person reading them.
 */
type PageScan = { found: ScanOk } | { unreachable: true } | null;

async function scanCmcPage(query: string, slug: string): Promise<PageScan> {
  if (!slug) return null;
  try {
    const html = await fetchText(
      // Short enough that a hung proxy does not hold the whole scan: there
      // are two more behind it.
      `https://coinmarketcap.com/currencies/${encodeURIComponent(slug)}/`,
      9000,
    );
    const rows = rowsFromCmcPage(html, slug);
    // The page was read and simply holds no contracts - a real answer.
    if (!rows.length) return null;
    const first = rows[0];
    return {
      found: {
        ok: true,
        source: "cmc",
        query,
        title: `${first.symbol || slug} · #${first.id ?? "—"}`,
        subtitle: `${rows.length} contract${rows.length === 1 ? "" : "s"} · ${slug}`,
        rows,
      },
    };
  } catch {
    return { unreachable: true };
  }
}

async function scanCmc(query: string): Promise<ScanResult> {
  const target = parseCmcTarget(query);
  const param = target.id
    ? `id=${encodeURIComponent(target.id)}`
    : `slug=${encodeURIComponent(target.slug || query)}`;
  let data: Record<string, unknown> | null = null;
  let apiReached = false;
  try {
    const body = asRecord(
      await fetchJson(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?${param}`),
    );
    apiReached = true;
    data = asRecord(body?.data);
  } catch {
    data = null;
  }
  if (!data) {
    // The API answers only to its own origin and refuses a slug it does not
    // recognise, so fall back to what the extension reads: the coin page's
    // own source, where the contracts are already rendered.
    const fromPage = await scanCmcPage(query, target.slug || String(target.id || query));
    if (fromPage && "found" in fromPage) return fromPage.found;
    const hint = target.slug || target.id || query;
    // Nothing answered: not the API, and not the page through any proxy. The
    // coin may well exist - saying it does not would send someone off
    // correcting a slug that was right all along.
    if (!apiReached && fromPage?.unreachable) {
      throw new Error(
        `Could not reach CoinMarketCap for “${hint}” — the API refuses this origin and every proxy was blocked or timed out. ` +
          `DexScreener still works; for CoinMarketCap, run XCap somewhere with a server (the Vercel setup in the README) or capture the page with the extension.`,
      );
    }
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

export function applyChartHit(
  result: ScanOk,
  hit: { dexId?: string; chain?: string; pool?: string; quote?: string; cs?: string },
): ScanOk {
  const pool = (hit.pool || "").toLowerCase();
  const dexId = (hit.dexId || "").toLowerCase();
  const quote = hit.quote || "";
  const cs = hit.cs && Number(hit.cs) > 0 ? String(hit.cs) : "";
  return {
    ...result,
    rows: result.rows.map((row) => {
      if (row.kind !== "dex") return row;
      if (pool && row.poolAddress.toLowerCase() !== pool) return row;
      return {
        ...row,
        dexId: dexId || row.dexId,
        quote: quote || row.quote,
        supply: cs || row.supply,
      };
    }),
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
  const ctrl = new AbortController();
  activeScan?.abort(new DOMException("Superseded", "AbortError"));
  activeScan = ctrl;
  try {
    return source === "dex" ? await scanDex(query) : await scanCmc(query);
  } catch (err) {
    if (ctrl.signal.aborted) return { ok: false, error: "Scan cancelled." };
    const message = err instanceof Error ? err.message : "Scan failed";
    return { ok: false, error: message };
  } finally {
    if (activeScan === ctrl) activeScan = null;
  }
}
