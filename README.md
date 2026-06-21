# 📈 IDX Stock Predictor — Realtime Edition

SvelteKit + Bun + **iTick WebSocket** untuk harga saham IDX real-time.

## ✨ Fitur Baru (vs versi sebelumnya)
- ⚡ **Harga LIVE** via WebSocket iTick (<50ms latency)
- 🟢 **Flash animasi** — harga naik (hijau) / turun (merah) setiap tick
- 🕐 **Indikator jam bursa** — otomatis deteksi market buka/tutup (WIB)
- 🔄 **Auto-reconnect** — koneksi WebSocket putus, otomatis sambung lagi
- 📡 **Badge "● LIVE"** di harga saat terhubung

## 🚀 Cara Pakai

### 1. Setup
```bash
bun install
bun run dev   # → http://localhost:5173
```

### 2. Aktifkan Realtime
1. Daftar gratis di **https://itick.org** (30 detik)
2. Buka Developer Console → copy **API Token**
3. Di app, klik **"⚡ Aktifkan Realtime"**
4. Paste API key → klik Hubungkan
5. Harga mulai update real-time ✅

### 3. Free Tier Limits (iTick)
| Fitur | Free |
|---|---|
| WebSocket connections | 1 |
| Subscriptions (saham) | 3 maks |
| REST calls | 5/menit |
| IDX coverage | Perlu dicek setelah daftar |

> Jika IDX tidak tersedia di free tier, app tetap berjalan normal
> dengan data Yahoo Finance (refresh manual).

## 🏗 File Baru
```
src/lib/
├── realtime.js                    ← WebSocket manager + market hours
└── components/
    └── RealtimeBar.svelte         ← UI connect/disconnect + status
```

## ⚠️ Disclaimer
Bukan saran investasi. Selalu lakukan riset mandiri.
