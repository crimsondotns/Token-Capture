import { Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { columnsOf, isCmc, jsonOf, presentRow, tsvOf } from "@/lib/present";
import type { Overview, ScanOk, ScanRow, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-2000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function Avatar({ src, symbol }: { src?: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-muted">
        {(symbol || "?").slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={36}
      height={36}
      className="size-9 shrink-0 rounded-full bg-surface-2 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function formatQty(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n >= 1 ? 0 : 6 }).format(n);
}

function Field({
  label,
  value,
  copyValue,
  hint,
}: {
  label: string;
  value: string;
  copyValue?: string;
  hint?: string;
}) {
  if (!value && !hint) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-16 shrink-0 pt-0.5 text-xs text-muted">{label}</span>
      {value ? (
        // The value is the button: an address is what the eye goes to and
        // what the hand wants to click, so a separate icon beside it was one
        // more target for the same job.
        <button
          type="button"
          title={`Copy ${label}`}
          className="min-w-0 flex-1 cursor-pointer break-all text-left font-mono text-sm leading-relaxed text-fg transition-colors duration-150 hover:text-muted"
          onClick={() => copyValue_(label, copyValue ?? value)}
        >
          {value}
        </button>
      ) : (
        <span className="min-w-0 flex-1 text-xs text-faint">{hint}</span>
      )}
    </div>
  );
}

// One place decides what a copy looks like from the outside: the text lands
// on the clipboard and the toast says so.
async function copyValue_(label: string, text: string) {
  try {
    await writeClipboard(text);
    toast.success("Copied");
  } catch {
    toast.error(`Could not copy ${label}`);
  }
}

function formatUsd(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)} K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// A price can be 68,000 or 0.000000004, so the number of decimals follows the
// magnitude rather than being fixed.
function formatPrice(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.000001 ? 6 : 10;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

/**
 * One card for the coin: what it is doing at the top, then everything worth
 * copying underneath. Two cards said the same thing twice - the same logo,
 * the same symbol - and put the contracts a scroll away from the name they
 * belong to.
 */
function CoinCard({ overview, rows }: { overview: Overview; rows: ScanRow[] }) {
  const contracts = rows.filter(isCmc);
  return (
    // No fill and no ring: the page is the card's ground, and the rules
    // between the figures carry the structure the box was drawing.
    <div className="mb-3 overflow-hidden">
      {/* The head copies every contract as TSV, the way a row header does
          elsewhere: the card replaced those rows, and their copy with them. */}
      <button
        type="button"
        title="Copy every contract as TSV"
        className="block w-full text-left"
        onClick={() => copyValue_("rows", contracts.map(tsvOf).join("\n"))}
      >
        <Preview overview={overview} />
      </button>
      <div className="px-3 pb-2 pt-1">
        {contracts.map((row, i) => (
          <Field
            key={`${row.platformId}-${row.tokenAddress}-${i}`}
            // The chain is the label when there is one: a coin on four chains
            // is four lines that would otherwise all read "Contract".
            label={row.platformName || "Contract"}
            value={row.tokenAddress}
          />
        ))}
        <Field label="Circulating" value={overview.circulating ? formatQty(overview.circulating) : ""} />
        <Field label="Total" value={overview.totalSupply ? formatQty(overview.totalSupply) : ""} />
      </div>
    </div>
  );
}

/** The head of the card: logo, name, price, and the three figures. */
function Preview({ overview }: { overview: Overview }) {
  const change = overview.change24h;
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar src={overview.image} symbol={overview.symbol} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted">
            {overview.name || overview.symbol}
            {overview.symbol ? ` (${overview.symbol})` : ""}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="truncate text-lg font-medium tracking-tight text-fg">
              {formatPrice(overview.priceUsd)}
            </span>
            {change != null ? (
              <span
                className={cn(
                  "text-sm tabular-nums",
                  change >= 0 ? "text-ok" : "text-warn",
                )}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {/* Divided rather than spaced: three figures of different lengths line
          up on their own columns instead of drifting. */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <Stat label="Rank" value={overview.rank != null ? `#${overview.rank}` : "—"} />
        <Stat label="Market cap" value={formatUsd(overview.marketCap)} />
        <Stat label="Volume 24h" value={formatUsd(overview.volume24h)} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-0.5 truncate text-sm tabular-nums text-fg">{value}</div>
    </div>
  );
}

function DexEmbed({ chain, pool }: { chain: string; pool: string }) {
  const src =
    `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(pool)}` +
    "?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15";
  return (
    // A gentler radius than the cards around it: DexScreener draws its own
    // header flush to the top corners of the frame, so anything rounder eats
    // the token name out of it.
    <div className="relative mb-3 w-full overflow-hidden rounded-lg bg-black pt-[48%] shadow-ring">
      <iframe
        title="DexScreener"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
}

export function Results({
  result,
  settings,
  extensionVersion,
  onClear,
  onOpenSheet,
}: {
  result: ScanOk;
  settings: Settings;
  // Version reported by the capture extension in the chart frame, or null
  // when nothing has spoken up: the difference between "still loading" and
  // "no extension is listening".
  extensionVersion?: string | null;
  onClear: () => void;
  onOpenSheet: (text: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo(
    () => result.rows.map((row) => presentRow(row, settings)),
    [result.rows, settings],
  );
  const columns = columnsOf(rows);
  const embed = result.rows.find((r): r is Extract<ScanRow, { kind: "dex" }> => r.kind === "dex");

  async function copy(label: string, text: string) {
    await writeClipboard(text);
    setCopied(label);
    window.setTimeout(() => setCopied((cur) => (cur === label ? null : cur)), 1400);
  }

  const tsv = rows.map(tsvOf).join("\n");
  const json = JSON.stringify(rows.map(jsonOf), null, 2);

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
      {embed ? <DexEmbed chain={embed.chain} pool={embed.poolAddress} /> : null}

      <div className="min-h-0 flex-1 overflow-auto pb-2 pt-4">
        {result.overview ? (
          <CoinCard overview={result.overview} rows={rows} />
        ) : rows.length === 0 ? (
          <p className="px-2 py-16 text-center text-sm text-muted">Nothing to show.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li
                key={rowKey(row, i)}
                className="rounded-2xl bg-surface px-3 py-3"
              >
                {isCmc(row) ? (
                  <>
                    <button
                      type="button"
                      title="Copy this row as TSV"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => copyValue_("row", tsvOf(row))}
                    >
                      <Avatar src={row.avatar} symbol={row.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">
                          {row.symbol || "—"}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {row.platformName || "Native"}
                          {row.slug ? ` · ${row.slug}` : ""}
                          {row.id != null ? ` · #${row.id}` : ""}
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 border-t border-border pt-1">
                      <Field label="Contract" value={row.tokenAddress} />
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      title="Copy this row as TSV"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => copyValue_("row", tsvOf(row))}
                    >
                      <Avatar src={row.imageUrl} symbol={row.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">
                          {row.symbol || "—"}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {row.dexId} · {row.chain}
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 border-t border-border pt-1">
                      <Field
                        label="DexID"
                        value={row.dexId}
                        hint={
                          extensionVersion
                            ? `from the chart worker… (XCap ${extensionVersion})`
                            : "install the XCap extension to capture this"
                        }
                      />
                      <Field label="Contract" value={row.contract} />
                      <Field label="Pool" value={row.poolAddress} />
                      <Field label="Quote" value={row.quote} />
                      <Field
                        label="Supply"
                        value={row.supply ? formatQty(row.supply) : ""}
                        copyValue={row.supply}
                      />
                      <Field
                        label="Total"
                        value={row.totalSupply ? formatQty(row.totalSupply) : ""}
                        copyValue={row.totalSupply}
                      />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button size="sm" onClick={() => copy("tsv", tsv)}>
          {copied === "tsv" ? "Copied" : "Copy TSV"}
        </Button>
        <Button size="sm" onClick={() => copy("json", json)}>
          {copied === "json" ? "Copied" : "JSON"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          onClick={() => onOpenSheet(tsv)}
        >
          <Link2 size={14} />
          Copy to sheet
        </Button>
        <Button size="icon" variant="ghost" title="Clear captured rows" onClick={onClear}>
          <Trash2 size={16} />
        </Button>
      </div>
      <p className="pb-1 text-xs text-faint">Columns — {columns.join(" · ")}</p>
    </section>
  );
}

function rowKey(row: ScanRow, i: number) {
  if (isCmc(row)) {
    return `cmc-${row.id}-${row.platformId}-${row.tokenAddress}-${i}`;
  }
  return `dex-${row.chain}-${row.poolAddress}-${row.quote}-${i}`;
}
