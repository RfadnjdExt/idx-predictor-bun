<script>
  import { onMount } from 'svelte';
  import { loadStock }     from '$lib/fetch.js';
  import { detectSignals } from '$lib/signals.js';
  import { IDX_STOCKS }    from '$lib/stocks.js';
  import InfoBar       from '$lib/components/InfoBar.svelte';
  import ChartPanel    from '$lib/components/ChartPanel.svelte';
  import SignalsPanel  from '$lib/components/SignalsPanel.svelte';
  import AIPanel       from '$lib/components/AIPanel.svelte';
  import RealtimeBar   from '$lib/components/RealtimeBar.svelte';

  // ── State (Svelte 5 runes) ─────────────────────────────
  let query     = $state('BBCA');
  let stock     = $state(null);
  let signals   = $state([]);
  let loading   = $state(false);
  let error     = $state(null);
  let activeTab = $state(0);
  let showDrop  = $state(false);
  let liveQuote = $state(null);

  // ── Derived ────────────────────────────────────────────
  let d90 = $derived(stock?.data?.slice(-90) ?? []);
  let last = $derived(stock?.data?.at(-1));
  let trendScore = $derived(
    last
      ? [last.ma5 > last.ma20, last.ma20 > last.ma50, last.rsi > 50, (last.mh ?? 0) > 0]
          .filter(Boolean).length - 2
      : 0
  );
  let filtered = $derived(
    IDX_STOCKS
      .filter(x => x.s.startsWith(query.toUpperCase()) || x.n.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
  );

  const TABS = [
    { label: '📈 Grafik & Indikator', idx: 0 },
    { label: '🎯 Sinyal Trading',     idx: 1 },
    { label: '🤖 Prediksi AI',        idx: 2 },
  ];

  // ── Actions ────────────────────────────────────────────
  function handleQuote(q) { liveQuote = q; }

  async function doLoad() {
    const sym = query.trim();
    if (!sym) return;
    loading = true; error = null; showDrop = false; liveQuote = null;
    try {
      const s = await loadStock(sym);
      stock   = s;
      signals = detectSignals(s.data);
    } catch(e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function pickStock(sym) {
    query    = sym;
    showDrop = false;
    doLoad();
  }

  onMount(() => doLoad());
</script>

<svelte:head>
  <title>{stock ? stock.ticker + ' — IDX Predictor' : 'IDX Stock Predictor'}</title>
</svelte:head>

<header>
  <div class="hinner">
    <div class="brand">
      <div class="brand-title mono">IDX STOCK PREDICTOR</div>
      <div class="brand-sub">REALTIME · ANALISIS TEKNIKAL &amp; AI · BURSA EFEK INDONESIA</div>
    </div>
    <div class="search-wrap">
      <div class="search-box">
        <input
          bind:value={query}
          oninput={() => (showDrop = true)}
          onkeydown={e => e.key === 'Enter' && (showDrop = false, doLoad())}
          onfocus={() => { if (query) showDrop = true; }}
          onblur={() => setTimeout(() => (showDrop = false), 160)}
          placeholder="BBCA, TLKM, GOTO..."
          class="s-input mono"
        />
        {#if showDrop && filtered.length}
          <div class="dropdown">
            {#each filtered as item}
              <button class="drop-row" onmousedown={() => pickStock(item.s)}>
                <span class="drop-code">{item.s}</span>
                <span class="drop-name">{item.n}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="s-btn" onclick={doLoad} disabled={loading}>
        {loading ? '···' : 'Cari'}
      </button>
    </div>
  </div>
</header>

<main>
  {#if error}
    <div class="error-box">⚠ {error}</div>
  {/if}

  {#if loading && !stock}
    <div class="loading">
      <div class="spin-icon">◈</div>
      <div>Mengambil data dari Yahoo Finance...</div>
    </div>
  {/if}

  {#if stock}
    <RealtimeBar symbol={stock.ticker.replace('.JK', '')} {handleQuote} />
    <InfoBar {stock} {signals} {trendScore} {liveQuote} />

    <div class="tabs">
      {#each TABS as t}
        <button class="tab-btn" class:active={activeTab === t.idx} onclick={() => (activeTab = t.idx)}>
          {t.label}
        </button>
      {/each}
    </div>

    {#if activeTab === 0}
      <ChartPanel {d90} />
    {:else if activeTab === 1}
      <SignalsPanel {stock} {signals} />
    {:else if activeTab === 2}
      <AIPanel {stock} {signals} />
    {/if}
  {/if}
</main>

<style>
header   { background:var(--surf); border-bottom:1px solid var(--border);
           padding:10px 16px; position:sticky; top:0; z-index:100; }
.hinner  { max-width:1100px; margin:0 auto; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.brand-title { font-weight:800; font-size:15px; color:var(--accent); letter-spacing:2px; }
.brand-sub   { font-size:10px; color:var(--muted); letter-spacing:1.5px; }

.search-wrap { margin-left:auto; display:flex; gap:8px; }
.search-box  { position:relative; }
.s-input     { background:var(--card); border:1px solid var(--border); border-radius:6px;
               padding:7px 12px; color:var(--text); font-size:13px; width:215px; }
.s-input:focus { border-color:var(--accent); outline:none; }
.s-btn       { background:var(--accent); color:#000; border:none; border-radius:6px;
               padding:7px 20px; font-weight:800; font-size:13px; }
.s-btn:hover:not(:disabled) { filter:brightness(1.1); }

.dropdown    { position:absolute; top:100%; left:0; right:0; margin-top:4px;
               background:var(--card); border:1px solid var(--border); border-radius:6px;
               box-shadow:0 8px 28px rgba(0,0,0,.6); z-index:200; overflow:hidden; }
.drop-row    { width:100%; text-align:left; background:transparent; border:none;
               border-bottom:1px solid var(--border); padding:8px 12px; cursor:pointer; }
.drop-row:hover { background:var(--border); }
.drop-code   { font-family:monospace; font-weight:800; color:var(--accent); margin-right:8px; }
.drop-name   { font-size:11px; color:var(--muted); }

main { max-width:1100px; margin:0 auto; padding:12px 14px 40px; }
.error-box { background:rgba(255,61,87,.1); border:1px solid var(--bear); border-radius:8px;
             padding:10px 14px; margin-bottom:12px; color:var(--bear); font-size:13px; }
.loading   { text-align:center; padding:80px; color:var(--muted); }
.spin-icon { font-size:34px; margin-bottom:12px; color:var(--accent); animation:spin 1.2s linear infinite; }

.tabs    { display:flex; gap:4px; margin-bottom:12px; background:var(--surf);
           border-radius:8px; padding:4px; width:fit-content; border:1px solid var(--border); }
.tab-btn { padding:6px 14px; border-radius:5px; border:none; font-size:12px;
           background:transparent; color:var(--muted); }
.tab-btn:hover { color:var(--text); }
.tab-btn.active { background:var(--accent); color:#000; font-weight:800; }
.mono { font-family:monospace; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
