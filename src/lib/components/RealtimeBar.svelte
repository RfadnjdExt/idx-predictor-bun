<script>
  import { isMarketOpen, marketCountdown, ITickWS } from '$lib/realtime.js';
  import { onMount } from 'svelte';

  let { symbol = 'BBCA', handleQuote = () => {} } = $props();

  let apiKey   = $state('');
  let client   = $state(null);
  let status   = $state('disconnected');
  let showKey  = $state(false);
  let mktOpen  = $state(false);
  let mktLabel = $state('');

  let isLive   = $derived(status === 'connected');
  let isError  = $derived(status.startsWith('error'));
  let isBusy   = $derived(status === 'connecting');

  function updateMarket() {
    mktOpen  = isMarketOpen();
    mktLabel = marketCountdown();
  }

  let mktTimer;
  onMount(() => {
    updateMarket();
    mktTimer = setInterval(updateMarket, 30_000);
  });

  $effect(() => {
    if (client && symbol) client.changeSymbol(symbol);
  });

  $effect(() => {
    return () => {
      client?.disconnect();
      clearInterval(mktTimer);
    };
  });

  function connect() {
    if (!apiKey.trim()) { showKey = true; return; }
    client = new ITickWS({
      apiKey:   apiKey.trim(),
      onQuote:  handleQuote,
      onStatus: s => (status = s),
    });
    client.connect(symbol);
  }

  function disconnect() {
    client?.disconnect();
    client = null;
    status = 'disconnected';
    showKey = false;
  }
</script>

<div class="bar">
  <div class="mkt" class:open={mktOpen} class:closed={!mktOpen}>
    <span class="mkt-dot"></span>
    {mktLabel}
  </div>

  {#if showKey && !client}
    <div class="key-wrap">
      <input
        bind:value={apiKey}
        type="password"
        placeholder="Paste iTick API Key..."
        class="key-input"
        onkeydown={e => e.key === 'Enter' && connect()}
      />
      <button class="conn-btn" onclick={connect}>Hubungkan</button>
      <button class="cancel-btn" onclick={() => (showKey = false)}>✕</button>
    </div>

  {:else if !client}
    <button class="rt-btn" onclick={() => (showKey = true)}>⚡ Aktifkan Realtime</button>

  {:else if isError}
    <div class="err-row">
      <span class="err-dot">●</span>
      <span class="err-txt">{status}</span>
      <button class="retry-btn" onclick={connect}>↺ Coba Lagi</button>
      <button class="disc-btn"  onclick={disconnect}>✕</button>
    </div>

  {:else}
    <div class="status-row">
      <span class="live-dot" class:pulse={isBusy}>●</span>
      <span class="status-txt" class:live={isLive}>
        {isLive ? 'LIVE · 5s' : status}
      </span>
      <button class="disc-btn" onclick={disconnect}>✕ Stop</button>
    </div>
  {/if}

  <a href="https://itick.org" target="_blank" rel="noreferrer" class="docs-link">iTick ↗</a>
</div>

<style>
.bar      { display:flex; align-items:center; gap:10px; flex-wrap:wrap;
            background:var(--surf); border:1px solid var(--border);
            border-radius:8px; padding:8px 14px; margin-bottom:12px; font-size:12px; }

.mkt      { display:flex; align-items:center; gap:6px; font-family:monospace; font-weight:700; }
.mkt-dot  { width:8px; height:8px; border-radius:50%; background:var(--muted); flex-shrink:0; }
.open .mkt-dot { background:var(--bull); box-shadow:0 0 6px var(--bull); animation:blink 1.2s ease infinite; }
.open  { color:var(--bull); }
.closed { color:var(--muted); }

.key-wrap   { display:flex; gap:6px; align-items:center; flex:1; }
.key-input  { background:var(--card); border:1px solid var(--border); border-radius:5px;
              padding:5px 10px; color:var(--text); font-size:12px; flex:1; min-width:180px; }
.key-input:focus { border-color:var(--accent); outline:none; }

.rt-btn     { background:transparent; border:1px solid var(--accent); border-radius:5px;
              color:var(--accent); padding:5px 12px; font-size:12px; font-weight:600; }
.rt-btn:hover { background:var(--accent); color:#000; }

.conn-btn   { background:var(--accent); border:none; border-radius:5px;
              color:#000; padding:5px 12px; font-weight:700; }
.cancel-btn { background:transparent; border:none; color:var(--muted); font-size:14px; padding:2px 6px; }
.cancel-btn:hover { color:var(--text); }

.status-row { display:flex; align-items:center; gap:6px; }
.err-row    { display:flex; align-items:center; gap:6px; }

.live-dot   { color:var(--muted); font-size:10px; }
.live-dot.pulse { animation:blink 1s ease infinite; color:var(--warn); }
.err-dot    { color:var(--bear); font-size:10px; }

.status-txt      { font-family:monospace; font-weight:700; font-size:12px; color:var(--muted); }
.status-txt.live { color:var(--bull); }
.err-txt    { font-family:monospace; font-size:11px; color:var(--bear);
              max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.retry-btn  { background:transparent; border:1px solid var(--warn); border-radius:4px;
              color:var(--warn); font-size:11px; padding:3px 8px; }
.retry-btn:hover { background:var(--warn); color:#000; }
.disc-btn   { background:transparent; border:1px solid var(--border); border-radius:4px;
              color:var(--muted); font-size:11px; padding:3px 8px; }
.disc-btn:hover { border-color:var(--bear); color:var(--bear); }

.docs-link  { margin-left:auto; color:var(--muted); text-decoration:none; font-size:11px; }
.docs-link:hover { color:var(--accent); }

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
</style>
