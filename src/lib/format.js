export const idr = v =>
  v == null ? '—'
  : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

export const priceTick = v =>
  v >= 1e6 ? (v / 1e6).toFixed(1) + 'jt'
  : v >= 1000 ? (v / 1000).toFixed(0) + 'rb'
  : String(Math.round(v));

export const fmt = (v, d = 2) =>
  v == null ? '—' : parseFloat(v.toFixed(d)).toString();

export const volFmt = v =>
  !v ? '—'
  : v >= 1e9 ? (v / 1e9).toFixed(1) + 'M'
  : v >= 1e6 ? (v / 1e6).toFixed(1) + 'jt'
  : v >= 1e3 ? (v / 1e3).toFixed(0) + 'rb'
  : String(v);
