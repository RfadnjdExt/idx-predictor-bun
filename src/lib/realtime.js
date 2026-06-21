// ── Market Hours (WIB = UTC+7) ────────────────────────────
export function isMarketOpen() {
  const wib  = new Date(Date.now() + 7 * 3600 * 1000);
  const day  = wib.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  return mins >= 9 * 60 && mins < 16 * 60;
}

export function marketCountdown() {
  const wib  = new Date(Date.now() + 7 * 3600 * 1000);
  const day  = wib.getUTCDay();
  const h    = wib.getUTCHours(), m = wib.getUTCMinutes();
  const mins = h * 60 + m;
  if (day >= 1 && day <= 5) {
    if (mins < 9 * 60) {
      const diff = 9 * 60 - mins;
      return `Buka dalam ${Math.floor(diff / 60)}j ${diff % 60}m`;
    }
    if (mins < 16 * 60) return 'Market BUKA';
    return 'Market TUTUP (hari ini)';
  }
  return 'Market TUTUP (weekend)';
}

// ── iTick WebSocket Manager ───────────────────────────────
const MAX_RETRY = 5; // berhenti setelah 5x gagal

export class ITickWS {
  constructor({ apiKey, onQuote, onStatus }) {
    this.apiKey   = apiKey;
    this.onQuote  = onQuote;
    this.onStatus = onStatus;
    this.ws       = null;
    this.symbol   = null;
    this.alive    = false;
    this.retryN   = 0;
  }

  connect(symbol) {
    this.symbol = symbol;
    this.alive  = true;
    this.retryN = 0;
    this._open();
  }

  _open() {
    if (!this.alive) return;

    // Stop setelah MAX_RETRY kali gagal
    if (this.retryN >= MAX_RETRY) {
      this.onStatus('failed');
      this.alive = false;
      return;
    }

    this.onStatus(this.retryN === 0 ? 'connecting' : `reconnecting (${this.retryN}/${MAX_RETRY})`);

    try {
      // Coba dua metode auth:
      // 1. Token sebagai query param (standar REST-over-WS)
      // 2. Token dikirim sebagai pesan pertama (fallback)
      this.ws = new WebSocket(`wss://api.itick.org/stock?token=${encodeURIComponent(this.apiKey)}`);
    } catch (e) {
      this.onStatus('error: gagal membuka koneksi');
      return;
    }

    const timeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.ws?.close();
      }
    }, 8000); // timeout 8 detik

    this.ws.onopen = () => {
      clearTimeout(timeout);
      this.retryN = 0;

      // Kirim auth sebagai pesan pertama (metode alternatif)
      this.ws.send(JSON.stringify({ token: this.apiKey }));

      // Lalu subscribe
      this._subscribe(this.symbol);
      this.onStatus('connected');
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);

        // Handle error dari server
        if (msg?.code && msg.code !== 200) {
          this.onStatus(`error: ${msg.msg || msg.code}`);
          this.alive = false;
          this.ws?.close();
          return;
        }

        const d = msg?.data;
        if (d?.type === 'quote') {
          this.onQuote({
            symbol:    d.s,
            price:     d.ld,
            open:      d.o,
            high:      d.h,
            low:       d.l,
            change:    d.c,
            changePct: d.pc,
            volume:    d.v,
            time:      d.t,
          });
        }
      } catch (_) {}
    };

    this.ws.onerror = () => {
      clearTimeout(timeout);
    };

    this.ws.onclose = ({ code, reason }) => {
      clearTimeout(timeout);
      if (!this.alive) { this.onStatus('disconnected'); return; }

      // Kode 4001/4003 = auth gagal — jangan retry
      if (code === 4001 || code === 4003) {
        this.onStatus('error: API key tidak valid');
        this.alive = false;
        return;
      }

      this.retryN++;
      const delay = Math.min(2000 * this.retryN, 10000);
      setTimeout(() => this._open(), delay);
    };
  }

  _subscribe(symbol) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      ac:     'subscribe',
      params: `${symbol}$ID`,
      types:  'quote',
    }));
  }

  changeSymbol(newSymbol) {
    if (this.symbol === newSymbol) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ac: 'unsubscribe', params: `${this.symbol}$ID`, types: 'quote' }));
    }
    this.symbol = newSymbol;
    this._subscribe(newSymbol);
  }

  disconnect() {
    this.alive = false;
    this.ws?.close();
    this.ws = null;
    this.onStatus('disconnected');
  }
}
