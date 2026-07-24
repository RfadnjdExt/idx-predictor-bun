<script>
  import { idr, volFmt } from '$lib/format.js';
  import { debugLog, debugError } from '$lib/debug.js';
  import { loadStock } from '$lib/fetch.js';
  import { detectSignals } from '$lib/signals.js';

  const CONCURRENCY = 3;

  let fileInput  = $state(null);
  let fileName   = $state('');
  let parsing    = $state(false);
  let parseError = $state(null);
  let result     = $state(null); // { totalRows, netBuyCount, cheaperHalfCount, rows }

  // code -> { status: 'loading'|'done'|'error', indicator, lastSignal, price, message }
  let signalMap = $state({});
  let checking  = $state(false);

  let doneCount  = $derived(Object.values(signalMap).filter((s) => s.status !== 'loading').length);
  let totalCount = $derived(result?.rows?.length ?? 0);

  function pickFile() {
    fileInput?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileName   = file.name;
    result     = null;
    signalMap  = {};
    parseError = null;
    parsing    = true;

    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const r = await fetch('/api/pdf-foreign', { method: 'POST', body: fd });
      if (!r.ok) {
        const msg = await r.text().catch(() => '');
        throw new Error(msg || `Gagal memproses PDF (${r.status})`);
      }
      result = await r.json();
      debugLog('Foreign flow parsed', result);
    } catch (err) {
      debugError('parse PDF failed', err);
      parseError = err.message;
    } finally {
      parsing = false;
      if (fileInput) fileInput.value = '';
    }
  }

  // Sama persis dengan badge "SINYAL" di InfoBar.svelte: indikator BUY/SELL
  // diambil dari TIPE sinyal event PALING BARU yang terdeteksi (Golden Cross,
  // RSI Oversold, dst), bukan skor tren terpisah — supaya tidak ada dua
  // definisi "sinyal" yang bisa saling bertentangan di halaman yang sama.
  function computeIndicator(sigs) {
    const lastSig = sigs.at(-1);
    const indicator = lastSig?.type === 'BUY' ? 'BUY' : lastSig?.type === 'SELL' ? 'SELL' : 'HOLD';
    return { indicator, lastSig };
  }

  async function checkAllSignals() {
    if (!result?.rows?.length) return;
    checking = true;
    const initial = {};
    for (const r of result.rows) initial[r.code] = { status: 'loading' };
    signalMap = initial;

    const queue = [...result.rows];

    async function worker() {
      while (queue.length) {
        const row = queue.shift();
        try {
          const s = await loadStock(row.code);
          const sigs = detectSignals(s.data);
          const { indicator, lastSig } = computeIndicator(sigs);
          signalMap = {
            ...signalMap,
            [row.code]: {
              status: 'done',
              indicator,
              price: s.price,
              lastSignal: lastSig?.label ?? null,
            },
          };
        } catch (e) {
          debugError(`checkAllSignals failed for ${row.code}`, e);
          signalMap = { ...signalMap, [row.code]: { status: 'error', message: e.message } };
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    checking = false;
  }

  // Otomatis cek sinyal begitu hasil parsing PDF siap.
  $effect(() => {
    if (result?.rows?.length) checkAllSignals();
  });
</script>

<div class="panel">
  <div class="header">
    <div>
      <div class="title">FOREIGN FLOW · DATA MIDDAY</div>
      <div class="sub">Upload PDF "Foreign Transaction Midday Data" (Stockbit) untuk dianalisis</div>
    </div>
    <button class="run-btn" onclick={pickFile} disabled={parsing}>
      {#if parsing}<span class="spin">◈</span> Membaca PDF...
      {:else}📄 Upload PDF{/if}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/pdf,.pdf"
      onchange={onFileChosen}
      style="display:none"
    />
  </div>

  {#if fileName && !parseError}
    <div class="filename mono">{fileName}</div>
  {/if}

  {#if parseError}
    <div class="err">⚠ {parseError}</div>
  {/if}

  {#if !result && !parsing && !parseError}
    <div class="empty">
      <div class="empty-icon">◈</div>
      <div class="empty-title">Belum ada data</div>
      <div class="empty-sub">Upload PDF Foreign Transaction Midday untuk melihat saham net BUY asing termurah</div>
    </div>
  {/if}

  {#if result}
    <div class="stats-row">
      <div class="stat"><div class="stat-val mono">{result.totalRows}</div><div class="stat-label">Total Baris</div></div>
      <div class="stat"><div class="stat-val mono bull">{result.netBuyCount}</div><div class="stat-label">Net BUY Asing</div></div>
      <div class="stat"><div class="stat-val mono">{result.cheaperHalfCount}</div><div class="stat-label">1/2 Termurah</div></div>
    </div>

    <div class="signal-bar">
      <div class="signal-status">
        {#if checking}
          <span class="spin">◈</span> Mengecek sinyal teknikal... ({doneCount}/{totalCount})
        {:else}
          ✓ Sinyal dicek untuk {doneCount}/{totalCount} saham
        {/if}
      </div>
      {#if !checking}
        <button class="rerun-btn" onclick={checkAllSignals}>↻ Cek Ulang</button>
      {/if}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Kode</th><th>Avg Price</th><th>Net Value</th>
            <th>Net Buy Vol</th><th>Sell Vol</th><th>Buy Vol</th><th>Sinyal</th>
          </tr>
        </thead>
        <tbody>
          {#each result.rows as r}
            {@const sig = signalMap[r.code]}
            <tr>
              <td class="mono">{r.no}</td>
              <td class="mono code">{r.code}</td>
              <td class="mono">{idr(r.avgPrice)}</td>
              <td class="mono bull">{r.netForeignValue.toLocaleString()}</td>
              <td class="mono">{volFmt(r.netForeignBuyVolume)}</td>
              <td class="mono">{volFmt(r.foreignSellVolume)}</td>
              <td class="mono">{volFmt(r.foreignBuyVolume)}</td>
              <td class="sig-cell">
                {#if !sig || sig.status === 'loading'}
                  <span class="badge badge-wait">···</span>
                {:else if sig.status === 'error'}
                  <span class="badge badge-na" title={sig.message}>N/A</span>
                {:else}
                  <span
                    class="badge"
                    class:badge-buy={sig.indicator === 'BUY'}
                    class:badge-sell={sig.indicator === 'SELL'}
                    class:badge-hold={sig.indicator === 'HOLD'}
                  >
                    {sig.indicator === 'BUY' ? '▲ BUY' : sig.indicator === 'SELL' ? '▼ SELL' : '● HOLD'}
                  </span>
                  {#if sig.lastSignal}
                    <div class="sig-sub">{sig.lastSignal}</div>
                  {/if}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="disc">⚠ Sinyal dihitung otomatis dari indikator teknikal (MA5/MA20/MA50, RSI, MACD). Bukan saran investasi profesional.</div>
  {/if}
</div>

<style>
.panel   { background:var(--surf); border:1px solid var(--border); border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px; }
.header  { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.title   { font-size:11px; color:var(--muted); letter-spacing:1px; }
.sub     { font-size:10px; color:var(--muted); margin-top:2px; }
.run-btn { background:linear-gradient(135deg,#7c3aed,#00c8ff); border:none; border-radius:7px;
           padding:9px 20px; color:#fff; font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px; }
.run-btn:hover:not(:disabled) { filter:brightness(1.1); }
.filename { font-size:12px; color:var(--text); background:var(--card); border:1px solid var(--border);
            border-radius:6px; padding:6px 10px; width:fit-content; }
.err     { background:rgba(255,61,87,.1); border:1px solid var(--bear); border-radius:8px; padding:10px; color:var(--bear); font-size:13px; }
.empty   { text-align:center; padding:60px; color:var(--muted); }
.empty-icon  { font-size:46px; opacity:.3; margin-bottom:14px; }
.empty-title { font-size:15px; color:var(--text); margin-bottom:6px; }
.empty-sub   { font-size:12px; }
.spin  { display:inline-block; animation:spin 1.2s linear infinite; }

.stats-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.stat      { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; text-align:center; }
.stat-val  { font-size:20px; font-weight:800; }
.stat-label{ font-size:10px; color:var(--muted); margin-top:4px; }

.signal-bar    { display:flex; align-items:center; justify-content:space-between; gap:8px;
                 background:var(--card); border:1px solid var(--border); border-radius:8px; padding:8px 12px; }
.signal-status { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:6px; }
.rerun-btn { background:transparent; border:1px solid var(--border); border-radius:6px; padding:5px 10px;
             color:var(--muted); font-size:11px; }
.rerun-btn:hover { color:var(--text); border-color:var(--accent); }

.table-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th    { text-align:right; padding:8px 10px; color:var(--muted); font-size:10px; letter-spacing:.5px;
        border-bottom:1px solid var(--border); white-space:nowrap; background:var(--card); }
th:nth-child(1), th:nth-child(2) { text-align:left; }
td    { text-align:right; padding:7px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
td:nth-child(1), td:nth-child(2) { text-align:left; }
.sig-cell { text-align:center; }
tbody tr:last-child td { border-bottom:none; }
tbody tr:hover { background:var(--card); }
.code  { color:var(--accent); font-weight:800; }

.badge      { display:inline-block; padding:3px 9px; border-radius:5px; font-size:11px; font-weight:800;
              letter-spacing:.5px; }
.badge-buy  { background:rgba(0,230,118,.14); color:var(--bull); }
.badge-sell { background:rgba(255,61,87,.14); color:var(--bear); }
.badge-hold { background:rgba(255,215,64,.14); color:#ffd740; }
.badge-wait { background:var(--card); color:var(--muted); }
.badge-na   { background:var(--card); color:var(--muted); }
.sig-sub    { font-size:9px; color:var(--muted); margin-top:3px; white-space:normal; max-width:120px; }

.disc   { font-size:10px; color:var(--muted); text-align:center; }
.bull   { color:var(--bull); }
.mono   { font-family:monospace; }
@keyframes spin  { to { transform:rotate(360deg); } }
</style>
