# XCap — Token Capture

Capture CoinMarketCap contracts and DexScreener pools. Nothing runs until you press Scan.

Live: [crimsondotns.github.io/XCap](https://crimsondotns.github.io/XCap/)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:8080. Paste a URL or pick a sample, then press Scan.

```bash
npm run build
```

Chrome extension: `public/xcap-extension.zip` (v2.4.0). Load unpacked from `public/xcap-extension/`.

## Host on GitHub Pages

Pages is already wired. Every push to `main` rebuilds the static app to the `gh-pages` branch.

Settings → Pages → Source: **Deploy from a branch** → `gh-pages` / `/ (root)`.

Serving from `main` instead renders this README as the site: the build output
lives on `gh-pages`, and `main` has no `index.html` at its root.

```bash
npm run build:pages
```

Scan runs in the browser (DexScreener allows CORS; CoinMarketCap falls back through a proxy).

## Host on Vercel

1. Open https://vercel.com/new and sign in with GitHub.
2. Import **`crimsondotns/XCap`**.
3. Root Directory: leave empty.
4. Build Command: `npm run build`
5. Environment variable (optional): `VITE_AUTH_ENABLED` = `false`
6. Deploy.
