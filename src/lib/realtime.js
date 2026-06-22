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

const POLL_INTERVAL = 5000; // 5 detik

export class ITickWS {
  constructor({ apiKey, onQuote, onStatus }) {
    this.apiKey   = apiKey;
    this.onQuote  = onQuote;
    this.onStatus = onStatus;
    this.symbol   = null;
    this.alive    = false;
    this.timer    = null;
  }

  connect(symbol) {
    this.symbol = symbol;
    this.alive  = true;
    this.onStatus('connecting');
    this._poll(); // langsung poll pertama
    this.timer = setInterval(() => this._poll(), POLL_INTERVAL);
  }

  async _poll() {
    if (!this.alive) return;
    try {
      const r = await fetch(
        `https://api.itick.org/stock/quote?region=ID&code=${this.symbol}`,
        { headers: { token: this.apiKey } }
      );
      const j = await r.json();

      if (j.code !== 0) {
        this.onStatus(`error: ${j.msg || `code ${j.code}`}`);
        return;
      }

      const d = j.data;
      this.onQuote({
        symbol:    d.s,
        price:     d.ld,
        open:      d.o,
        high:      d.h,
        low:       d.l,
        change:    d.ch,
        changePct: d.chp,
        volume:    d.v,
        time:      d.t,
      });
      this.onStatus('connected');
    } catch (e) {
      this.onStatus('error: gagal fetch data');
    }
  }

  changeSymbol(newSymbol) {
    if (this.symbol === newSymbol) return;
    this.symbol = newSymbol;
    this._poll(); // langsung poll tanpa tunggu interval
  }

  disconnect() {
    this.alive = false;
    clearInterval(this.timer);
    this.timer = null;
    this.onStatus('disconnected');
  }
}
