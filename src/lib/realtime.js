// ── Market Hours (WIB = UTC+7) ────────────────────────────
export function isMarketOpen() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const day  = wib.getUTCDay(); // 0=Sun 6=Sat
  if (day === 0 || day === 6) return false;
  const mins = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  return mins >= 9 * 60 && mins < 16 * 60; // 09:00–16:00 WIB
}

export function marketCountdown() {
  const wib  = new Date(Date.now() + 7 * 3600 * 1000);
  const day  = wib.getUTCDay();
  const h    = wib.getUTCHours(), m = wib.getUTCMinutes();
  const mins = h * 60 + m;

  if (day >= 1 && day <= 5) {
    if (mins < 9 * 60) {
      const diff = 9 * 60 - mins;
      return `Buka dalam ${Math.floor(diff/60)}j ${diff%60}m`;
    }
    if (mins < 16 * 60) return 'Market BUKA';
    return 'Market TUTUP (hari ini)';
  }
  return 'Market TUTUP (weekend)';
}

// ── iTick WebSocket Manager ───────────────────────────────
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
    this.onStatus('connecting');
    // Browser WebSocket doesn't support custom headers,
    // so token is passed as query param
    const url = `wss://api.itick.org/stock?token=${encodeURIComponent(this.apiKey)}`;
    try {
      this.ws = new WebSocket(url);
    } catch(e) {
      this.onStatus('error');
      return;
    }

    this.ws.onopen = () => {
      this.retryN = 0;
      this.onStatus('connected');
      this._subscribe(this.symbol);
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        const d   = msg?.data;
        if (d?.type === 'quote') {
          this.onQuote({
            symbol:    d.s,
            price:     d.ld,   // last done
            open:      d.o,
            high:      d.h,
            low:       d.l,
            change:    d.c,
            changePct: d.pc,
            volume:    d.v,
            time:      d.t,
          });
        }
      } catch(_) {}
    };

    this.ws.onerror = () => this.onStatus('error');

    this.ws.onclose = () => {
      if (!this.alive) { this.onStatus('disconnected'); return; }
      this.retryN++;
      const delay = Math.min(2000 * this.retryN, 15000);
      this.onStatus(`reconnecting (${this.retryN})`);
      setTimeout(() => this._open(), delay);
    };
  }

  _subscribe(symbol) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      ac: 'subscribe',
      params: `${symbol}$ID`,
      types: 'quote',
    }));
  }

  changeSymbol(newSymbol) {
    if (this.symbol === newSymbol) return;
    // Unsubscribe old
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ac: 'unsubscribe',
        params: `${this.symbol}$ID`,
        types: 'quote',
      }));
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
