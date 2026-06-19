<script>
  import { idr, fmt } from '$lib/format.js';
  export let stock;
  export let signals;
  export let trendScore;

  $: last = stock?.data?.at(-1);
  $: up   = stock?.change >= 0;
</script>

<div class="bar">
  <div class="block">
    <div class="ticker mono">{stock.ticker}</div>
    <div class="name">{stock.name}</div>
  </div>

  <div class="block">
    <div class="price mono" class:bull={up} class:bear={!up}>{idr(stock.price)}</div>
    <div class="change mono" class:bull={up} class:bear={!up}>
      {up ? '▲' : '▼'} {idr(Math.abs(stock.change))} ({stock.changePct.toFixed(2)}%)
    </div>
  </div>

  {#if last}
  <div class="stats">
    {#each [
      { l:'Trend', v: trendScore > 0 ? 'Bullish' : trendScore < 0 ? 'Bearish' : 'Netral',
        cl: trendScore > 0 ? 'bull' : trendScore < 0 ? 'bear' : 'muted' },
      { l:'RSI',
        v: fmt(last.rsi, 1) + (last.rsi > 70 ? ' ↑' : last.rsi < 30 ? ' ↓' : ''),
        cl: last.rsi > 70 ? 'bear' : last.rsi < 30 ? 'bull' : '' },
      { l:'MACD',
        v: (last.mh ?? 0) > 0 ? 'Bullish' : 'Bearish',
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
.bar   { background: var(--surf); border: 1px solid var(--border); border-radius: 10px;
         padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 20px; margin-bottom: 12px; }
.block { display: flex; flex-direction: column; gap: 3px; }
.ticker { font-size: 18px; font-weight: 800; color: var(--accent); }
.name   { font-size: 11px; color: var(--muted); }
.price  { font-size: 26px; font-weight: 800; }
.change { font-size: 12px; }
.stats  { margin-left: auto; display: flex; gap: 20px; flex-wrap: wrap; }
.stat   { text-align: right; }
.stat-l { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; }
.stat-v { font-size: 13px; font-weight: 700; }
.bull   { color: var(--bull); }
.bear   { color: var(--bear); }
.muted  { color: var(--muted); }
.mono   { font-family: monospace; }
</style>
