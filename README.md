# XCap — Token Capture

Capture CoinMarketCap contracts and DexScreener pools. Nothing runs until you press Scan.

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

## Host on Vercel

1. Open https://vercel.com/new and sign in with GitHub.
2. Import **`crimsondotns/Token-Capture`**.
3. Root Directory: leave empty (this repo *is* the app).
4. Build Command: `npm run build`
5. Install Command: `npm install`
6. Environment variable (optional): `VITE_AUTH_ENABLED` = `false`
7. Deploy.

Every push to `main` rebuilds the site.

GitHub Pages cannot run this app — Scan needs a server. Use Vercel.
