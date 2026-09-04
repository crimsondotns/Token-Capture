# XCap — Token Capture

Capture CoinMarketCap contracts and DexScreener pools. Nothing runs until you press Scan.

Live: [crimsondotns.github.io/Token-Capture](https://crimsondotns.github.io/Token-Capture/)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:8080. Paste a URL or pick a sample, then press Scan.

```bash
npm run build
```

Chrome extension: `public/xcap-extension.zip` (v2.2.0). Load unpacked from `public/xcap-extension/`.

## Host on GitHub Pages

Pages is already wired. Every push to `main` rebuilds the static app to the `gh-pages` branch.

Settings → Pages → Source: **Deploy from a branch** → `gh-pages` / `/ (root)`.

```bash
npm run build:pages
```

Scan runs in the browser (DexScreener allows CORS; CoinMarketCap falls back through a proxy).

## Host on Vercel

1. Open https://vercel.com/new and sign in with GitHub.
2. Import **`crimsondotns/Token-Capture`**.
3. Root Directory: leave empty.
4. Build Command: `npm run build`
5. Environment variable (optional): `VITE_AUTH_ENABLED` = `false`
6. Deploy.
