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

const MAX_RETRY = 5;

// Auth strategies untuk browser WebSocket (tidak support custom header)
const AUTH_STRATEGIES = [
  // 1. Token sebagai Sec-WebSocket-Protocol (satu-satunya "header" yang bisa dari browser)
  (url, token) => new WebSocket(url, [token]),
  // 2. Token sebagai query param
  (url, token) => new WebSocket(`${url}?token=${encodeURIComponent(token)}`),
  // 3. Tanpa auth di URL (kirim via pesan pertama)
  (url, token) => new WebSocket(url),
];

export class ITickWS {
  constructor({ apiKey, onQuote, onStatus }) {
    this.apiKey    = apiKey;
    this.onQuote   = onQuote;
    this.onStatus  = onStatus;
    this.ws        = null;
    this.symbol    = null;
    this.alive     = false;
    this.retryN    = 0;
    this.stratIdx  = 0; // coba strategi auth satu per satu
  }

  connect(symbol) {
    this.symbol   = symbol;
    this.alive    = true;
    this.retryN   = 0;
    this.stratIdx = 0;
    this._open();
  }

  _open() {
    if (!this.alive) return;

    if (this.retryN >= MAX_RETRY) {
      this.onStatus('error: gagal terhubung (cek API key)');
      this.alive = false;
      return;
    }

    const label = this.retryN === 0 ? 'connecting' : `reconnecting (${this.retryN}/${MAX_RETRY})`;
    this.onStatus(label);

    const url = 'wss://api.itick.org/stock';
    const strategy = AUTH_STRATEGIES[this.stratIdx % AUTH_STRATEGIES.length];

    try {
      this.ws = strategy(url, this.apiKey);
    } catch (e) {
      this.onStatus('error: gagal membuka koneksi');
      return;
    }

    const timeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) this.ws?.close();
    }, 8000);

    this.ws.onopen = () => {
      clearTimeout(timeout);
      // Kirim auth via pesan pertama sebagai fallback
      this.ws.send(JSON.stringify({ token: this.apiKey }));
      this._subscribe(this.symbol);
      this.onStatus('connected');
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);

        // Server error — coba strategi auth berikutnya
        if (msg?.code && msg.code !== 0) {
          this.onStatus(`error: ${msg.msg || msg.code}`);
          this.alive = false;
          this.ws?.close();
          return;
        }

        const d = msg?.data;
        if (d?.type === 'quote') {
          this.onQuote({
            symbol:    d.s,
            price:     d.ld,   // last done
            open:      d.o,
            high:      d.h,
            low:       d.l,
            change:    d.ch,   // ← fix: ch bukan c
            changePct: d.chp,  // ← fix: chp bukan pc
            volume:    d.v,
            time:      d.t,
          });
        }
      } catch (_) {}
    };

    this.ws.onerror = () => clearTimeout(timeout);

    this.ws.onclose = ({ code }) => {
      clearTimeout(timeout);
      if (!this.alive) { this.onStatus('error: gagal terhubung (cek API key)'); return; }

      if (code === 4001 || code === 4003) {
        this.onStatus('error: API key tidak valid');
        this.alive = false;
        return;
      }

      // Ganti strategi auth setiap 2 retry
      this.retryN++;
      if (this.retryN % 2 === 0) this.stratIdx++;

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
