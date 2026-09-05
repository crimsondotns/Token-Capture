import { Check, Copy, Link2, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { columnsOf, isCmc, jsonOf, matchQuery, presentRow, tsvOf } from "@/lib/present";
import type { ScanOk, ScanRow, Settings } from "@/lib/types";
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

function CopyIcon({
  getText,
  title = "Copy",
  compact,
}: {
  getText: () => string;
  title?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 1200);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg",
        compact ? "size-8" : "size-11",
        state === "ok" && "text-ok",
      )}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await writeClipboard(getText());
          setState("ok");
        } catch {
          setState("err");
        }
      }}
    >
      {state === "ok" ? <Check size={compact ? 14 : 16} /> : <Copy size={compact ? 14 : 16} />}
    </button>
  );
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
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-16 shrink-0 pt-0.5 text-xs text-faint">{label}</span>
      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-fg">{value}</code>
      <CopyIcon compact getText={() => copyValue ?? value} title={`Copy ${label}`} />
    </div>
  );
}

export function Results({
  result,
  settings,
  onClear,
  onOpenSheet,
}: {
  result: ScanOk;
  settings: Settings;
  onClear: () => void;
  onOpenSheet: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const presented = useMemo(
    () => result.rows.map((row) => presentRow(row, settings)),
    [result.rows, settings],
  );
  const rows = useMemo(
    () => presented.filter((row) => matchQuery(query, row)),
    [presented, query],
  );
  const columns = columnsOf(presented);

  async function copy(label: string, text: string) {
    await writeClipboard(text);
    setCopied(label);
    window.setTimeout(() => setCopied((cur) => (cur === label ? null : cur)), 1400);
  }

  const tsv = rows.map(tsvOf).join("\n");
  const json = JSON.stringify(rows.map(jsonOf), null, 2);

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
      <div className="flex items-baseline gap-2 px-1 pb-3 pt-4">
        <h2 className="text-lg font-medium tracking-tight text-fg">
          {result.source === "cmc" ? "Tokens" : "Pools"}
        </h2>
        <span className="tabular-nums text-sm text-muted">{rows.length}</span>
        <span className="ml-auto truncate text-sm text-faint">{result.title}</span>
      </div>

      <div className="mb-3 flex h-11 items-center gap-2 rounded-full bg-surface px-3 shadow-ring">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter — sol, chain:solana, sym:btc"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent font-sans text-sm text-fg outline-none placeholder:text-faint"
        />
        {query ? (
          <>
            <span className="tabular-nums text-xs text-faint">
              {rows.length}/{presented.length}
            </span>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fg"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
            >
              <X size={14} />
            </button>
          </>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {rows.length === 0 ? (
          <p className="px-2 py-16 text-center text-sm text-muted">
            Nothing matches that filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li
                key={rowKey(row, i)}
                className="rounded-2xl bg-surface px-3 py-3 shadow-ring"
              >
                {isCmc(row) ? (
                  <>
                    <div className="flex items-center gap-3">
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
                      <CopyIcon getText={() => tsvOf(row)} title="Copy this row as TSV" />
                    </div>
                    <div className="mt-2 border-t border-border pt-1">
                      <Field label="Contract" value={row.tokenAddress} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar src={row.imageUrl} symbol={row.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">
                          {row.symbol || "—"}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {row.dexId} · {row.chain}
                        </div>
                      </div>
                      <CopyIcon getText={() => tsvOf(row)} title="Copy this row as TSV" />
                    </div>
                    <div className="mt-2 border-t border-border pt-1">
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
