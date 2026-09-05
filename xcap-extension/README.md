# Chart & Token Capture

Both capture scripts as one extension. Nothing is published to a store and
nothing leaves the browser.

- **DexScreener** — captures the chart endpoint for the pool on screen
- **CoinMarketCap** — reads token contracts out of the page source

## Setup

**Requires Chrome or Edge 111 or newer.** Older builds ignore the `world`
field in the manifest, which silently puts the scripts in the wrong place —
they load, but capture nothing.

1. Put this folder somewhere permanent. The browser reads it from this path
   on every start, so moving or deleting it breaks the extension.

2. Open the extensions page:
   - Edge — `edge://extensions/`
   - Chrome — `chrome://extensions/`

3. Turn on **Developer mode** (left sidebar in Edge, top right in Chrome).

4. **Load unpacked**, and pick this folder — the one holding `manifest.json`.

5. Pin it: puzzle-piece icon in the toolbar, then the pin next to
   *Chart & Token Capture*.

6. Click the icon, check the **Google Sheet** URL, **Save**.

Open a DexScreener pool page or a CoinMarketCap coin page. Press **Scan** in
the toolbar popup — the panel does not open by itself, so the page stays clean.

## Using it

Nothing is captured until you press **Scan** (toolbar popup) or the panel's
refresh control. The panel is draggable by its header and remembers nothing.

### Filtering

The box under the header filters the rows as you type. Plain words match any
field; `field:value` narrows to one, and several terms all have to match.

```
sol                    anything containing "sol"
chain:solana           chain only
sym:btc                symbol only
ucid:1                 exactly id 1 — not 1041
chain:solana pump      both must match
```

Fields are `sym` `slug` `ucid` `chain` `pid` `addr` on CoinMarketCap, and
`sym` `chain` `dex` `pool` `quote` `addr` on DexScreener. Ids compare exactly,
everything else by substring. Escape clears the box.

Whatever is on screen is what the copy buttons take, so a filter is also a way
to export a subset.

| Control | Does |
| --- | --- |
| Filter / layers | This pool or coin only, versus everything found on the page |
| Search box | Filter the rows; the count shows shown/total |
| Refresh | Scan the page again (CoinMarketCap) |
| Minus / plus | Collapse to the header |
| X | Close — the popup's **Show Panel** brings it back |
| TSV | Tab-separated rows, for pasting into a sheet |
| JSON | The same rows as JSON |
| Copy + Open Sheet | Copies every row, then opens the sheet: click, paste |
| Trash | Drop everything captured so far |

Per-row copy buttons take that one row on its own.

## Settings

All in the popup, applied immediately — a page already open picks them up
without a reload.

| Setting | Effect |
| --- | --- |
| Google Sheet | Where **Copy + Open Sheet** goes |
| Open the sheet in this tab | Off opens a new tab and leaves the page behind it |
| Build avatar URLs from the CMC id | Only when the page carries none of its own |
| Native coins get UCID=&lt;id&gt; | BTC and the like have no contract for that column |

## How it fits together

A content script cannot both reach `chrome.storage` and hook the page's own
`fetch`: those live in different worlds and share nothing but the DOM.

- `content-dexscreener.js` and `content-cmc.js` run in the **MAIN** world,
  where the page's `fetch` and its embedded JSON are reachable — and where
  `chrome.*` is not.
- `bridge.js` runs in the **ISOLATED** world, reads the settings, and writes
  them onto the root element as `data-xcap-config`.
- The capture scripts read that attribute at startup and again on every
  `xcap:config` event, so a change in the popup reaches an open page.
- **Show Panel** goes the same way, as `xcap:show`.

Both run at `document_start`, ahead of the page's own scripts. On DexScreener
that is what lets the pair-details response be read as it arrives instead of
re-requested; on CoinMarketCap it means the payload is caught however late it
streams in.

The panel is rendered inside a **shadow root**, so the host page's stylesheets
cannot reach it and it cannot leak into theirs.

## Design

Monospace throughout, one dark palette, square corners. Icons are
[Lucide](https://lucide.dev) (ISC), inlined as path data — MV3 forbids remote
code and the page's CSP would block a CDN either way, so there is no
stylesheet or sprite to fetch.

The toolbar icon ships size-specific artwork: the full mark for 48 and 128px,
and a simplified one for 16 and 32px, where the scan brackets would otherwise
collapse into mush.

## Updating

Edit the files in `src/`, then from the project root:

```
node build.js          # rebuilds the content scripts, userscripts, bookmarklets
node tools/render.js   # re-renders the icons from src/icon*.svg
```

Then press the reload arrow on the extension card. `content-*.js` in here are
generated — editing them directly is undone by the next build.

## Troubleshooting

**Panel never appears** — check the browser version, then that the page is
`https://dexscreener.com/…` or `https://coinmarketcap.com/…`. On DexScreener,
switch timeframe to make the chart request fire.

**Nothing found on CoinMarketCap** — open the console and run `__cmc.probe()`.
It reports which keys the page actually contains.

**Settings do not stick** — the folder moved after loading. Remove the
extension and load it again from the new path.
