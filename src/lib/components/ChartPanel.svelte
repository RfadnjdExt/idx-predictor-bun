<script>
  import { priceAction, macdAction, rsiAction } from '$lib/charts.js';

  let { d90 = [] } = $props();
</script>

<div class="panel">
  <div class="legend">
    {#each [
      { col:'#fff',    label:'Harga' },
      { col:'#00e5ff', label:'MA5' },
      { col:'#ff9100', label:'MA20' },
      { col:'#d580ff', label:'MA50' },
      { col:'#4488ff', label:'Bollinger Band', dash:true },
    ] as l}
      <span class="leg-item">
        <span class="leg-line" style="background:{l.col}; {l.dash ? 'border-top:2px dashed '+l.col+';background:transparent' : ''}"></span>
        {l.label}
      </span>
    {/each}
  </div>

  <div class="card">
    <div class="clabel">HARGA · BOLLINGER BANDS · MA (90 Hari Terakhir)</div>
    <div class="cwrap" style="height:300px">
      <canvas use:priceAction={d90}></canvas>
    </div>
  </div>

  <div class="row2">
    <div class="card">
      <div class="clabel">MACD (12, 26, 9)</div>
      <div class="cwrap" style="height:140px">
        <canvas use:macdAction={d90}></canvas>
      </div>
      <div class="sub-legend">
        <span><span class="dot-line" style="background:#00c8ff"></span>MACD</span>
        <span><span class="dot-line" style="background:#ffd740"></span>Signal</span>
        <span><span class="dot-sq" style="background:#00e676aa"></span>Bullish</span>
        <span><span class="dot-sq" style="background:#ff3d57aa"></span>Bearish</span>
      </div>
    </div>
    <div class="card">
      <div class="clabel-row">
        <span class="clabel">RSI (14)</span>
        <span class="rsi-hint"><span style="color:#ff3d57">■</span> OB &gt;70 · <span style="color:#00e676">■</span> OS &lt;30</span>
      </div>
      <div class="cwrap" style="height:140px">
        <canvas use:rsiAction={d90}></canvas>
      </div>
    </div>
  </div>
</div>

<style>
.panel    { display:flex; flex-direction:column; gap:10px; }
.legend   { display:flex; gap:14px; flex-wrap:wrap; padding:0 2px; font-size:11px; color:var(--muted); align-items:center; }
.leg-item { display:flex; align-items:center; gap:5px; }
.leg-line { display:inline-block; width:20px; height:2px; }
.card     { background:var(--surf); border:1px solid var(--border); border-radius:10px; padding:14px; }
.cwrap    { position:relative; }
canvas    { display:block; width:100% !important; height:100% !important; }
.clabel   { font-size:11px; color:var(--muted); letter-spacing:1px; margin-bottom:10px; }
.clabel-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.rsi-hint   { font-size:10px; color:var(--muted); }
.row2       { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.sub-legend { display:flex; gap:12px; margin-top:8px; font-size:10px; color:var(--muted); }
.dot-line   { display:inline-block; width:14px; height:2px; vertical-align:middle; margin-right:3px; }
.dot-sq     { display:inline-block; width:10px; height:10px; vertical-align:middle; margin-right:3px; }
@media (max-width:640px) { .row2 { grid-template-columns:1fr; } }
</style>
