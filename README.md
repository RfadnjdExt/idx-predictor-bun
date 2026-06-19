# 📈 IDX Stock Predictor — SvelteKit + Bun

Aplikasi prediksi saham **Bursa Efek Indonesia (IDX)** berbasis SvelteKit,
dijalankan dengan **[Bun](https://bun.sh)** — runtime JavaScript yang jauh lebih cepat dari Node.js.

## ✨ Fitur
- 📊 **Grafik Harga** — 90 hari + Bollinger Bands
- 📈 **Moving Averages** — MA5, MA20, MA50
- ⚡ **MACD** — Histogram + Line + Signal
- 🔢 **RSI (14)** — Overbought / Oversold
- 🎯 **Sinyal Trading** — Golden Cross, Death Cross, RSI, MACD, BB Breakout
- 🤖 **Prediksi AI** — Analisis Claude dengan target harga & stop loss

---

## 🚀 Cara Menjalankan

### Prasyarat: Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
```

### Development
```bash
bun install
bun run dev        # → http://localhost:5173
```

### Production Build
```bash
bun run build
bun run preview    # → http://localhost:4173
```

### Deploy Static
Folder `build/` siap deploy ke Netlify, Vercel, GitHub Pages, atau server statis apapun.

```bash
# Contoh serve lokal dengan Bun
bunx serve build
```

---

## ⚡ Kenapa Bun?

| | npm | Bun |
|---|---|---|
| Install 51 packages | ~8 detik | **74ms** |
| Runtime | Node.js | Bun (JavaScriptCore) |
| Lock file | package-lock.json | bun.lockb |
| Built-in test | ✗ | ✓ |

---

## 🏗 Struktur Proyek
```
src/
├── routes/
│   ├── +layout.svelte        # Root layout + CSS global
│   ├── +page.js              # prerender = true
│   └── +page.svelte          # Halaman utama
└── lib/
    ├── indicators.js          # SMA, EMA, Bollinger, MACD, RSI
    ├── signals.js             # Deteksi sinyal trading
    ├── format.js              # Format IDR & angka
    ├── stocks.js              # 20 saham IDX populer
    ├── fetch.js               # Yahoo Finance via CORS proxy
    ├── charts.js              # Svelte actions → Chart.js
    └── components/
        ├── InfoBar.svelte     # Harga + indikator ringkas
        ├── ChartPanel.svelte  # Price / MACD / RSI charts
        ├── SignalsPanel.svelte # Status + daftar sinyal
        └── AIPanel.svelte     # Prediksi AI (Claude API)
```

---

## ⚠️ Disclaimer
Analisis AI dan sinyal teknikal bukan saran investasi profesional.
Investasi saham memiliki risiko. Selalu lakukan riset mandiri.
