import {
  ArrowUp,
  Check,
  Download,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CometSpinner } from "@/components/comet-spinner";
import { Mark } from "@/components/mark";
import { Results } from "@/components/results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSettings, saveSettings } from "@/lib/settings";
import type { ScanOk, ScanResult, Settings, Source } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { applyChartHit, cancelScan } from "@/lib/scan-impl";
import { cn } from "@/lib/utils";

const SAMPLES: { source: Source; label: string; query: string }[] = [
  { source: "cmc", label: "Bitcoin", query: "https://coinmarketcap.com/currencies/bitcoin/" },
  { source: "cmc", label: "Tether", query: "https://coinmarketcap.com/currencies/tether/" },
  { source: "cmc", label: "Solana", query: "https://coinmarketcap.com/currencies/solana/" },
  { source: "dex", label: "dogwifhat", query: "WIF" },
  {
    source: "dex",
    label: "SOL / USDC",
    query: "https://dexscreener.com/solana/58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
  },
];

export function XCapApp() {
  const [source, setSource] = useState<Source>("cmc");
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<"settings" | "install" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  // What the DexScreener frame reports about the capture extension, if any.
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string;
        type?: string;
        version?: string;
        dexId?: string;
        chain?: string;
        pool?: string;
        quote?: string;
        cs?: string;
      } | null;
      if (!data || data.source !== "xcap") return;
      if (data.type !== "chart" && data.type !== "hello") return;
      let host = "";
      try {
        host = new URL(ev.origin).hostname;
      } catch {
        return;
      }
      if (host !== "dexscreener.com" && !host.endsWith(".dexscreener.com")) return;
      // Either message proves a content script is running in the frame.
      setExtensionVersion((prev) => data.version || prev || "unknown");
      if (data.type !== "chart") return;
      setResult((prev) => (prev ? applyChartHit(prev, data) : prev));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  async function executeScan(q: string, src: Source): Promise<ScanResult> {
    if (import.meta.env.VITE_PAGES === "true") {
      const { performScan } = await import("@/lib/scan-impl");
      return performScan({ query: q, source: src });
    }
    try {
      const { runScan } = await import("@/lib/scan.functions");
      return await runScan({ data: { query: q, source: src } });
    } catch {
      const { performScan } = await import("@/lib/scan-impl");
      return performScan({ query: q, source: src });
    }
  }

  // Cancelling has to survive the in-flight promise resolving anyway: the
  // requests are aborted, but a scan far enough along can still return a
  // result, and it is no longer wanted.
  const scanRun = useRef(0);

  function cancelCurrentScan() {
    scanRun.current += 1;
    cancelScan();
    setScanning(false);
  }

  async function scan() {
    const q = query.trim();
    if (!q) {
      setError("Paste a URL, slug, or symbol first.");
      return;
    }
    const run = scanRun.current + 1;
    scanRun.current = run;
    setScanning(true);
    setError(null);
    try {
      const out = await executeScan(q, source);
      if (scanRun.current !== run) return;
      setHasScanned(true);
      if (!out.ok) {
        setResult(null);
        setError(out.error);
        return;
      }
      setResult(out);
      if (!out.rows.length) {
        setError("Nothing found for that query.");
        return;
      }
      // Only once rows came back: a failed or empty scan leaves the query in
      // place to be corrected rather than retyped.
      setQuery("");
    } catch (err) {
      if (scanRun.current !== run) return;
      setResult(null);
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      if (scanRun.current === run) setScanning(false);
    }
  }

  async function copyAndOpenSheet(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste into the sheet");
    } catch {
      toast.error("Copy failed");
    }
    if (!settings.sheetUrl) {
      toast.error("Set a Google Sheet URL in settings");
      return;
    }
    if (settings.sheetSameTab) {
      window.location.href = settings.sheetUrl;
    } else {
      window.open(settings.sheetUrl, "_blank", "noopener");
    }
  }

  // A scan with nothing to show yet keeps the idle screen: the dialog covers
  // it, and "Nothing found" would be wrong for a scan still running.
  const idle = (!hasScanned || scanning) && !result;
  const canScan = query.trim().length > 0 && !scanning;

  function pickSample(s: (typeof SAMPLES)[number]) {
    setQuery(s.query);
    setSource(s.source);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="shrink-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Mark size={32} />
          <div className="min-w-0">
            <h1 className="text-sm font-medium tracking-tight text-fg">XCap</h1>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Download extension"
              onClick={() => setPanel(panel === "install" ? null : "install")}
            >
              <Download size={18} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Settings"
              onClick={() => setPanel(panel === "settings" ? null : "settings")}
            >
              <Settings2 size={18} />
            </Button>
          </div>
        </div>
      </header>

      {panel === "settings" ? (
        <Overlay onClose={() => setPanel(null)}>
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            onClose={() => setPanel(null)}
          />
        </Overlay>
      ) : null}
      {scanning ? (
        <ScanningDialog query={query} source={source} onCancel={cancelCurrentScan} />
      ) : null}
      {panel === "install" ? (
        <Overlay onClose={() => setPanel(null)}>
          <InstallPanel onClose={() => setPanel(null)} />
        </Overlay>
      ) : null}

      {/* The composer floats over this, so the last row has to clear it. */}
      <main className="mx-auto flex w-full min-h-0 flex-1 flex-col pb-40">
        {result && result.rows.length ? (
          <Results
            result={result}
            settings={settings}
            extensionVersion={extensionVersion}
            onClear={() => {
              setResult(null);
              setError(null);
              setHasScanned(false);
            }}
            onOpenSheet={copyAndOpenSheet}
          />
        ) : error ? (
          <IdleFrame>
            <p className="max-w-md text-center text-base text-fg">{error}</p>
            <p className="text-sm text-muted">Edit the prompt and send again.</p>
          </IdleFrame>
        ) : idle ? (
          <IdleFrame>
            <Mark size={56} className="enter" />
            <div className="enter enter-2 max-w-md space-y-2 text-center">
              <h2 className="text-3xl font-medium tracking-tight text-fg sm:text-4xl">
                Ready when you are.
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Paste a CoinMarketCap coin or a DexScreener pool. Nothing runs until you
                send it.
              </p>
              <p className="text-sm text-faint">กด Scan เมื่อพร้อม — ไม่สแกนอัตโนมัติ</p>
            </div>
            <div className="enter enter-3 flex flex-wrap justify-center gap-2 pt-2">
              {SAMPLES.filter((s) => s.source === source).map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="h-11 rounded-full bg-surface px-4 text-sm text-fg shadow-ring transition-colors duration-150 hover:bg-surface-2"
                  onClick={() => pickSample(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </IdleFrame>
        ) : (
          <IdleFrame>
            <p className="text-base text-muted">Nothing found for that query.</p>
          </IdleFrame>
        )}
      </main>

      {/* Floating: fixed to the viewport rather than sitting at the end of the
          column, so it stays reachable while the results scroll under it. The
          gradient keeps text from colliding with it on the way past. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-bg via-bg/90 to-transparent">
        <form
          className="pointer-events-auto mx-auto w-full max-w-3xl px-4"
          onSubmit={(e) => {
            e.preventDefault();
            void scan();
          }}
        >
          <div className="rounded-3xl bg-surface p-2 shadow-composer">
            <div className="flex gap-1 px-2 pt-1">
              <SourceTab
                active={source === "cmc"}
                onClick={() => setSource("cmc")}
                label="CoinMarketCap"
              />
              <SourceTab
                active={source === "dex"}
                onClick={() => setSource("dex")}
                label="DexScreener"
              />
            </div>
            <div className="flex items-end gap-2 p-1 pt-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  source === "cmc"
                    ? "Ask for a coin — bitcoin, tether, or a CMC URL"
                    : "Ask for a pool — WIF, or a DexScreener URL"
                }
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="URL or symbol to scan"
                className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 font-sans text-base text-fg outline-none placeholder:text-faint"
              />
              <Button
                type="submit"
                variant="primary"
                size="send"
                disabled={!canScan}
                aria-label="Scan"
                className="mb-0.5"
              >
                <ArrowUp size={18} />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SourceTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-3 text-sm font-medium transition-colors duration-150",
        active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function IdleFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
      {children}
    </div>
  );
}

// Modal rather than a line in the results: a scan crosses several hosts and
// can take seconds, and the page underneath is the previous scan's, which is
// no longer what the answer will be.
function ScanningDialog({
  query,
  source,
  onCancel,
}: {
  query: string;
  source: Source;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Scanning"
      // Anywhere, not just the backdrop: there is nothing here to click on
      // for its own sake, so a click on the spinner means the same thing.
      onClick={onCancel}
      // Frosted rather than dimmed: a heavy blur with the colour left in, so
      // the results behind stay recognisable as shapes without competing with
      // the card. The tint is light because blur, not darkness, is what
      // separates the two layers.
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-bg/50 backdrop-blur-2xl backdrop-saturate-150"
    >
      {/* No card: the frosted backdrop is the surface, so a second one behind
          the text only boxes it in. */}
      <div className="enter flex w-full max-w-sm flex-col items-center gap-4 px-6 py-8 text-center">
        <CometSpinner size={30} thickness={3} className="text-fg" />
        <div className="w-full space-y-1">
          <p className="text-base font-medium text-fg">
            Scanning {source === "cmc" ? "CoinMarketCap" : "DexScreener"}…
          </p>
          {/* Short queries sit still; only a value too wide to fit runs. */}
          {query.length > 34 ? (
            <div
              className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%-2rem),transparent)]"
              title={query}
            >
              <div className="marquee pulse-soft whitespace-nowrap text-sm text-muted">
                <span>{query}</span>
                <span aria-hidden="true">{query}</span>
              </div>
            </div>
          ) : (
            <p className="pulse-soft truncate text-sm text-muted" title={query}>
              {query}
            </p>
          )}
        </div>
        <button
          type="button"
          className="text-xs text-faint transition-colors duration-150 hover:text-fg"
          onClick={onCancel}
        >
          Click anywhere or press Esc to cancel
        </button>
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-bg/70"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg px-3 pb-3 sm:pb-0">{children}</div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-fg">Settings</h2>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:text-fg"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <label className="mb-1.5 block text-sm text-muted">Google Sheet</label>
      <Input
        value={settings.sheetUrl}
        onChange={(e) => onChange({ sheetUrl: e.target.value })}
        placeholder="https://docs.google.com/spreadsheets/d/…"
        spellCheck={false}
      />
      <div className="mt-2">
        <Toggle
          checked={settings.sheetSameTab}
          onChange={(v) => onChange({ sheetSameTab: v })}
          name="Open the sheet in this tab"
          why="Off opens a new tab and leaves this one behind"
        />
        <Toggle
          checked={settings.deriveAvatar}
          onChange={(v) => onChange({ deriveAvatar: v })}
          name="Build avatar URLs from the CMC id"
          why="Only when the page carries none of its own"
        />
        <Toggle
          checked={settings.nativeAsUcid}
          onChange={(v) => onChange({ nativeAsUcid: v })}
          name="Native coins get UCID=<id>"
          why="BTC and the like have no contract for that column"
        />
      </div>
      <div className="mt-4">
        <Button
          variant="primary"
          onClick={() => {
            saveSettings(settings);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1400);
          }}
        >
          {saved ? <Check size={16} /> : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  name,
  why,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  name: string;
  why: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-fg" : "bg-surface-2 shadow-ring",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full transition-transform duration-150",
            checked ? "translate-x-4 bg-bg" : "translate-x-0.5 bg-muted",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{name}</span>
        <span className="block text-xs leading-relaxed text-faint">{why}</span>
      </span>
    </label>
  );
}

function InstallPanel({ onClose }: { onClose: () => void }) {
  const steps = [
    "Download the zip and unzip it somewhere permanent.",
    "Chrome or Edge 111+ → extensions page → Developer mode.",
    "Load unpacked, pick the unzipped folder (the one with manifest.json).",
    "Pin it. Open a DexScreener pool or CMC coin. Press Scan in the popup — the page stays clean until then.",
  ];
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium text-fg">Chrome extension</h2>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:text-fg"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Same capture as this app, on the live page. Nothing runs until you press Scan.
      </p>
      <ol className="mb-5 space-y-2.5 text-sm leading-relaxed text-muted">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="w-4 shrink-0 tabular-nums text-faint">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <a
        href={`${import.meta.env.BASE_URL}xcap-extension.zip`}
        download="xcap-extension.zip"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-4 font-sans text-sm font-medium text-bg hover:bg-white"
      >
        <Download size={16} />
        Download extension
      </a>
    </div>
  );
}
