<script>
  import { idr, fmt } from '$lib/format.js';

  let { stock, signals = [] } = $props();

  let last = $derived(stock?.data?.at(-1));

  let statusItems = $derived(last ? [
    { l:'Trend MA',  v: last.ma5 > last.ma20 ? 'Bullish' : 'Bearish',
      bull: last.ma5 > last.ma20, bear: !(last.ma5 > last.ma20),
      sub: `MA5 ${last.ma5 > last.ma20 ? '>' : '<'} MA20` },
    { l:'RSI (14)',  v: last.rsi > 70 ? 'Overbought' : last.rsi < 30 ? 'Oversold' : 'Netral',
      bull: last.rsi < 30, bear: last.rsi > 70,
      sub: `Nilai: ${fmt(last.rsi, 1)}` },
    { l:'MACD',      v: (last.mh ?? 0) > 0 ? 'Bullish' : 'Bearish',
      bull: (last.mh ?? 0) > 0, bear: (last.mh ?? 0) < 0,
      sub: `Histogram: ${fmt(last.mh)}` },
    { l:'Bollinger', v: last.close > last.bb_u ? 'Di Atas Band' : last.close < last.bb_l ? 'Di Bawah Band' : 'Dalam Band',
      bull: last.close < last.bb_l, bear: last.close > last.bb_u,
      sub: last.bb_u && last.bb_l
        ? `${((last.close - last.bb_l) / (last.bb_u - last.bb_l) * 100).toFixed(0)}% posisi`
        : '—' },
  ] : []);

  let revSigs = $derived([...signals].reverse());
</script>

<div class="panel">
  <div class="grid4">
    {#each statusItems as it}
      <div class="scard" class:scard-bull={it.bull} class:scard-bear={it.bear}>
        <div class="slabel">{it.l}</div>
        <div class="sval mono" class:bull={it.bull} class:bear={it.bear}>{it.v}</div>
        <div class="ssub">{it.sub}</div>
      </div>
    {/each}
  </div>

  <div class="listcard">
    <div class="list-title">SINYAL TERDETEKSI · {signals.length} sinyal (terbaru pertama)</div>
    {#if revSigs.length === 0}
      <div class="empty">Tidak ada sinyal terdeteksi dalam periode ini</div>
    {:else}
      {#each revSigs as sg}
        {@const d = stock.data[sg.i]}
        <div class="sig" class:sig-buy={sg.type === 'BUY'} class:sig-sell={sg.type === 'SELL'}>
          <div class="badge" class:buy={sg.type === 'BUY'} class:sell={sg.type === 'SELL'}>
            {sg.type === 'BUY' ? '↑ BELI' : '↓ JUAL'}
          </div>
          <div class="info">
            <div class="info-l">{sg.label}</div>
            <div class="info-s">{sg.sub}</div>
          </div>
          <div class="datecol">
            <div class="mono muted">{d?.date}</div>
            <div class="mono">{idr(d?.close)}</div>
          </div>
          <div class="dots">
            {#each [1,2,3] as n}
              <div class="dot"
                class:dot-buy={sg.type === 'BUY' && n <= sg.str}
                class:dot-sell={sg.type === 'SELL' && n <= sg.str}
                class:dot-off={n > sg.str}>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
.panel    { display:flex; flex-direction:column; gap:10px; }
.grid4    { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.scard    { background:var(--surf); border:1px solid var(--border); border-radius:8px; padding:12px 14px; }
.scard-bull { border-color:#00e67633; }
.scard-bear { border-color:#ff3d5733; }
.slabel   { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:1.2px; margin-bottom:6px; }
.sval     { font-size:13px; font-weight:700; }
.ssub     { font-size:10px; color:var(--muted); margin-top:3px; }
.listcard { background:var(--surf); border:1px solid var(--border); border-radius:10px; padding:14px; }
.list-title { font-size:11px; color:var(--muted); letter-spacing:1px; margin-bottom:12px; }
.empty    { text-align:center; padding:40px; color:var(--muted); }
.sig      { display:flex; align-items:center; gap:10px; background:var(--card); border-radius:7px;
            padding:10px 14px; margin-bottom:6px; }
.sig-buy  { border-left:3px solid var(--bull); }
.sig-sell { border-left:3px solid var(--bear); }
.badge    { font-family:monospace; font-weight:800; padding:4px 8px; border-radius:4px;
            font-size:11px; min-width:58px; text-align:center; color:#000; }
.badge.buy  { background:var(--bull); }
.badge.sell { background:var(--bear); }
.info     { flex:1; }
.info-l   { font-size:12px; font-weight:600; color:var(--text); }
.info-s   { font-size:10px; color:var(--muted); }
.datecol  { text-align:right; }
.dots     { display:flex; gap:3px; }
.dot      { width:7px; height:7px; border-radius:50%; }
.dot-buy  { background:var(--bull); }
.dot-sell { background:var(--bear); }
.dot-off  { background:var(--border); }
.bull  { color:var(--bull); }
.bear  { color:var(--bear); }
.muted { color:var(--muted); }
.mono  { font-family:monospace; }
@media (max-width:640px) { .grid4 { grid-template-columns:repeat(2,1fr); } }
</style>
