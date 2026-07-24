import { sma, ema, bollinger, calcMACD, calcRSI } from './indicators.js';

export async function loadStock(symbol) {
  const t = symbol.toUpperCase().replace(/\.JK$/, '') + '.JK';
  const code = symbol.toUpperCase().replace(/\.JK$/, '');

  let json;
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 9000);
    const r    = await fetch(`/api/stock/${code}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (r.ok) json = await r.json();
  } catch { /* falls through to error below */ }

  if (!json?.chart?.result?.[0])
    throw new Error('Gagal mengambil data. Periksa kode saham atau coba lagi.');

  const res = json.chart.result[0];
  const { timestamp, meta, indicators: { quote: [q] } } = res;

  const raw = timestamp
    .map((ts, i) => ({
      ts,
      close: q.close[i], open: q.open[i], high: q.high[i], low: q.low[i], vol: q.volume[i],
      date: new Date(ts * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }),
      ds:   new Date(ts * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    }))
    .filter(d => d.close != null);

  const cl = raw.map(d => d.close);
  const bb = bollinger(cl, 20);
  const { ml, ms, mh } = calcMACD(cl);

  const data = raw.map((d, i) => ({
    ...d,
    ma5:  sma(cl, 5)[i],
    ma20: sma(cl, 20)[i],
    ma50: sma(cl, 50)[i],
    bb_u: bb[i].u, bb_m: bb[i].m, bb_l: bb[i].l,
    ml: ml[i], ms: ms[i], mh: mh[i],
    rsi: calcRSI(cl, 14)[i],
  }));

  const price = meta.regularMarketPrice ?? cl.at(-1);
  const prev  = meta.previousClose    ?? cl.at(-2) ?? price;

  return {
    ticker: t,
    name: meta.shortName || t,
    price,
    change:    price - prev,
    changePct: ((price - prev) / prev) * 100,
    high52: meta.fiftyTwoWeekHigh,
    low52:  meta.fiftyTwoWeekLow,
    data,
  };
}
