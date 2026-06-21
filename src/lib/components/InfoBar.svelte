<script>
  import { idr, fmt } from '$lib/format.js';

  let { stock, signals, trendScore, liveQuote = null } = $props();

  let last      = $derived(stock?.data?.at(-1));
  let price     = $derived(liveQuote?.price     ?? stock?.price);
  let change    = $derived(liveQuote?.change    ?? stock?.change);
  let changePct = $derived(liveQuote?.changePct ?? stock?.changePct);
  let up        = $derived((change ?? 0) >= 0);

  // Flash animation on price tick
  let flash     = $state('');
  let prevPrice = $state(null);

  $effect(() => {
    const p = liveQuote?.price;
    if (p != null) {
      if (prevPrice !== null && p !== prevPrice) {
        flash = p > prevPrice ? 'flash-up' : 'flash-down';
        setTimeout(() => (flash = ''), 500);
      }
      prevPrice = p;
    }
  });
</script>

<div class="bar">
  <div class="block">
    <div class="ticker mono">{stock.ticker}</div>
    <div class="name">{stock.name}</div>
  </div>

  <div class="block">
    <div class="price mono {flash}" class:bull={up} class:bear={!up}>
      {idr(price)}
      {#if liveQuote}<span class="live-badge">● LIVE</span>{/if}
    </div>
    <div class="change mono" class:bull={up} class:bear={!up}>
      {up ? '▲' : '▼'} {idr(Math.abs(change ?? 0))} ({(changePct ?? 0).toFixed(2)}%)
    </div>
    {#if liveQuote?.high || liveQuote?.low}
      <div class="hl">H: {idr(liveQuote.high)} · L: {idr(liveQuote.low)}</div>
    {/if}
  </div>

  {#if last}
    <div class="stats">
      {#each [
        { l:'Trend',  v: trendScore > 0 ? 'Bullish' : trendScore < 0 ? 'Bearish' : 'Netral',
          cl: trendScore > 0 ? 'bull' : trendScore < 0 ? 'bear' : 'muted' },
        { l:'RSI',    v: fmt(last.rsi, 1) + (last.rsi > 70 ? ' ↑' : last.rsi < 30 ? ' ↓' : ''),
          cl: last.rsi > 70 ? 'bear' : last.rsi < 30 ? 'bull' : '' },
        { l:'MACD',   v: (last.mh ?? 0) > 0 ? 'Bullish' : 'Bearish',
          cl: (last.mh ?? 0) > 0 ? 'bull' : 'bear' },
        { l:'Sinyal', v: signals.at(-1)?.type ?? '—',
          cl: signals.at(-1)?.type === 'BUY' ? 'bull' : signals.at(-1)?.type === 'SELL' ? 'bear' : 'muted' },
      ] as it}
        <div class="stat">
          <div class="stat-l">{it.l}</div>
          <div class="stat-v mono {it.cl}">{it.v}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
.bar    { background:var(--surf); border:1px solid var(--border); border-radius:10px;
          padding:14px 18px; display:flex; flex-wrap:wrap; align-items:center; gap:20px; margin-bottom:12px; }
.block  { display:flex; flex-direction:column; gap:3px; }
.ticker { font-size:18px; font-weight:800; color:var(--accent); }
.name   { font-size:11px; color:var(--muted); }
.price  { font-size:26px; font-weight:800; display:flex; align-items:center; gap:8px; }
.change { font-size:12px; }
.hl     { font-size:11px; color:var(--muted); font-family:monospace; margin-top:2px; }
.live-badge { font-size:10px; font-weight:700; color:var(--bull); font-family:monospace;
              animation:liveblink 1.2s ease infinite; }
.flash-up   { animation:flashUp   0.5s ease; }
.flash-down { animation:flashDown 0.5s ease; }
.stats  { margin-left:auto; display:flex; gap:20px; flex-wrap:wrap; }
.stat   { text-align:right; }
.stat-l { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:1.2px; }
.stat-v { font-size:13px; font-weight:700; }
.bull  { color:var(--bull); }
.bear  { color:var(--bear); }
.muted { color:var(--muted); }
.mono  { font-family:monospace; }
@keyframes flashUp   { 0%{background:rgba(0,230,118,.25)} 100%{background:transparent} }
@keyframes flashDown { 0%{background:rgba(255,61,87,.25)}  100%{background:transparent} }
@keyframes liveblink { 0%,100%{opacity:1} 50%{opacity:.3} }
</style>
