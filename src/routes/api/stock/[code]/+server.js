import { json, error } from '@sveltejs/kit';

// Server-to-server fetch — tidak kena batasan CORS, jadi tidak perlu proxy publik
// (corsproxy.io / allorigins.win) yang gampang rate-limited saat dipanggil berkali-kali.
export async function GET({ params }) {
  const code = params.code?.toUpperCase().replace(/\.JK$/, '');
  if (!code || !/^[A-Z0-9]{1,10}$/.test(code)) {
    throw error(400, 'Kode saham tidak valid');
  }

  const ticker = `${code}.JK`;
  const now = Math.floor(Date.now() / 1000);
  const yr = now - 365 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${yr}&period2=${now}`;

  let res;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 9000);
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IDXStockPredictor/1.0)' },
    });
    clearTimeout(tid);
  } catch {
    throw error(502, 'Gagal menghubungi Yahoo Finance');
  }

  if (!res.ok) {
    throw error(res.status === 404 ? 404 : 502, `Data untuk ${ticker} tidak ditemukan`);
  }

  const data = await res.json();
  if (!data?.chart?.result?.[0]) {
    throw error(404, `Data untuk ${ticker} tidak ditemukan`);
  }

  return json(data);
}
