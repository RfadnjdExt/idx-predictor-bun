import Chart from 'chart.js/auto';
import { idr, priceTick, fmt } from './format.js';

const C = {
  accent: '#00c8ff', bull: '#00e676', bear: '#ff3d57', warn: '#ffd740',
  text: '#b8d4f0', muted: '#3d5a78', card: '#0e1c33', border: '#1c3050',
  ma5: '#00e5ff', ma20: '#ff9100', ma50: '#d580ff', bb: '#4488ff',
};

const nn  = a => a.map(v => v == null ? null : v);
const xCfg = {
  grid: { color: '#1c305044' },
  ticks: { color: C.muted, font: { size: 9, family: 'monospace' }, maxTicksLimit: 10 },
};
const yCfg = cb => ({
  grid: { color: '#1c305044' },
  ticks: { color: C.muted, font: { size: 9, family: 'monospace' }, maxTicksLimit: 7, callback: cb },
});
const tipCfg = fn => ({
  backgroundColor: C.card, borderColor: C.border, borderWidth: 1,
  titleColor: C.muted, bodyColor: C.text, bodyFont: { family: 'monospace', size: 11 },
  callbacks: { label: fn },
});

// ── PRICE ACTION ──────────────────────────────────────────
export function priceAction(node, data) {
  let chart = null;
  function build(d) {
    if (chart) chart.destroy();
    if (!d?.length) return;
    const labels = d.map(x => x.ds);
    const closes = d.map(x => x.close);
    const vals   = [...d.map(x => x.bb_l), ...closes].filter(v => v != null && isFinite(v) && v > 0);
    const pMin   = Math.min(...vals) * 0.997;
    const pMax   = Math.max(...d.map(x => x.bb_u ?? x.close).filter(v => v != null && isFinite(v))) * 1.003;
    chart = new Chart(node, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'BB Atas',  data: nn(d.map(x => x.bb_u)), borderColor: C.bb+'88', borderWidth: 1, borderDash: [5,3], pointRadius: 0, fill: false, spanGaps: false },
        { label: 'BB Mid',   data: nn(d.map(x => x.bb_m)), borderColor: C.bb+'44', borderWidth: 1, borderDash: [2,5], pointRadius: 0, fill: false, spanGaps: false },
        { label: 'BB Bawah', data: nn(d.map(x => x.bb_l)), borderColor: C.bb+'88', borderWidth: 1, borderDash: [5,3], pointRadius: 0, fill: false, spanGaps: false },
        { label: 'Harga',    data: closes,                  borderColor: '#ffffff',  borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'MA5',      data: nn(d.map(x => x.ma5)),  borderColor: C.ma5,      borderWidth: 1.5, pointRadius: 0, fill: false, spanGaps: false },
        { label: 'MA20',     data: nn(d.map(x => x.ma20)), borderColor: C.ma20,     borderWidth: 1.5, pointRadius: 0, fill: false, spanGaps: false },
        { label: 'MA50',     data: nn(d.map(x => x.ma50)), borderColor: C.ma50,     borderWidth: 1.5, pointRadius: 0, fill: false, spanGaps: false },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: tipCfg(ctx => ctx.raw != null ? `${ctx.dataset.label}: ${idr(ctx.raw)}` : null),
        },
        scales: { x: xCfg, y: { ...yCfg(priceTick), min: pMin, max: pMax, position: 'right' } },
      },
    });
  }
  build(data);
  return { update: d => build(d), destroy: () => { if (chart) chart.destroy(); } };
}

// ── MACD ACTION ───────────────────────────────────────────
export function macdAction(node, data) {
  let chart = null;
  function build(d) {
    if (chart) chart.destroy();
    if (!d?.length) return;
    const labels = d.map(x => x.ds);
    chart = new Chart(node, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Histogram', data: nn(d.map(x => x.mh)),
          backgroundColor: d.map(x => (x.mh ?? 0) >= 0 ? C.bull+'aa' : C.bear+'aa'),
          borderWidth: 0, order: 2 },
        { label: 'MACD',   data: nn(d.map(x => x.ml)), type: 'line', borderColor: C.accent, borderWidth: 1.5, pointRadius: 0, fill: false, spanGaps: false, order: 1 },
        { label: 'Signal', data: nn(d.map(x => x.ms)), type: 'line', borderColor: C.warn,   borderWidth: 1.5, pointRadius: 0, fill: false, spanGaps: false, order: 1 },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: tipCfg(ctx => ctx.raw != null ? `${ctx.dataset.label}: ${parseFloat(ctx.raw.toFixed(2))}` : null),
        },
        scales: { x: xCfg, y: { ...yCfg(v => v.toFixed(0)), position: 'right' } },
      },
    });
  }
  build(data);
  return { update: d => build(d), destroy: () => { if (chart) chart.destroy(); } };
}

// ── RSI ACTION ────────────────────────────────────────────
export function rsiAction(node, data) {
  let chart = null;
  function build(d) {
    if (chart) chart.destroy();
    if (!d?.length) return;
    const labels = d.map(x => x.ds);
    chart = new Chart(node, {
      type: 'line',
      data: { labels, datasets: [
        { label: '_ob', data: d.map(() => 70), borderColor: C.bear+'66', borderWidth: 1, borderDash: [4,3], pointRadius: 0, fill: false },
        { label: '_os', data: d.map(() => 30), borderColor: C.bull+'66', borderWidth: 1, borderDash: [4,3], pointRadius: 0, fill: false },
        { label: 'RSI', data: nn(d.map(x => x.rsi)), borderColor: C.ma50, borderWidth: 2, pointRadius: 0, fill: false, spanGaps: false },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: tipCfg(ctx => ctx.dataset.label === 'RSI' && ctx.raw != null
            ? `RSI: ${parseFloat(ctx.raw.toFixed(2))}` : null),
        },
        scales: { x: xCfg, y: { ...yCfg(v => v.toFixed(0)), min: 0, max: 100, position: 'right' } },
      },
    });
  }
  build(data);
  return { update: d => build(d), destroy: () => { if (chart) chart.destroy(); } };
}
