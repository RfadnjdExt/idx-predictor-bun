<script>
  import { idr, volFmt } from '$lib/format.js';
  import { debugLog, debugError } from '$lib/debug.js';

  let fileInput  = $state(null);
  let fileName   = $state('');
  let parsing    = $state(false);
  let parseError = $state(null);
  let result     = $state(null); // { totalRows, netBuyCount, cheaperHalfCount, rows }

  let aiResult  = $state(null);
  let aiLoading = $state(false);
  let aiError   = $state(null);
  let aiModel   = $state(null);

  function formatModelLabel(modelId) {
    if (!modelId) return 'AI';
    const name = modelId.includes('/') ? modelId.split('/').pop() : modelId;
    return name.replace(/[-.]/g, ' ').toUpperCase();
  }
  let modelLabel = $derived(formatModelLabel(aiModel));

  function pickFile() {
    fileInput?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileName   = file.name;
    result     = null;
    aiResult   = null;
    aiError    = null;
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

  async function runAI() {
    if (!result?.rows?.length) return;
    aiLoading = true; aiError = null; aiResult = null;
    try {
      const rowsText = result.rows
        .map(
          (r) =>
            `${r.no}. ${r.code} avg=${idr(r.avgPrice)} netValue=${r.netForeignValue.toLocaleString()} ` +
            `netBuyVol=${r.netForeignBuyVolume.toLocaleString()} buyVol=${r.foreignBuyVolume.toLocaleString()}`
        )
        .join('\n');

      const prompt =
        `Kamu analis saham profesional Indonesia. Berikut daftar saham IDX yang sudah difilter dari data ` +
        `Foreign Transaction Midday (Stockbit): hanya saham dengan net BUY asing, diambil setengah dengan ` +
        `harga rata-rata (avg) termurah, lalu diurutkan dari volume beli asing (buyVol) terbanyak ke tersedikit.\n\n` +
        `Total baris terbaca: ${result.totalRows}, net BUY asing: ${result.netBuyCount}, ` +
        `diambil (1/2 termurah): ${result.cheaperHalfCount}.\n\n` +
        `DAFTAR SAHAM:\n${rowsText}\n\n` +
        `Tugas kamu: pilih maksimal 5 saham paling menarik dari daftar ini untuk dipertimbangkan trader jangka ` +
        `pendek, dengan alasan singkat berbasis data (harga murah relatif, volume beli asing besar, dsb).\n\n` +
        `Balas HANYA JSON (tanpa backtick):\n` +
        `{"ringkasan":"2-3 kalimat ringkasan kondisi aliran dana asing hari ini",` +
        `"pilihan":[{"code":"KODE","alasan":"1 kalimat"}]}`;

      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      debugLog('HTTP status', r.status);
      if (!r.ok) {
        const msg = await r.text().catch(() => '');
        throw new Error(msg || `Request gagal (${r.status})`);
      }
      const j = await r.json();
      debugLog('Raw response body', j);
      aiModel = j.model ?? null;
      const txt = j.choices?.[0]?.message?.content ?? j.content?.[0]?.text ?? '';
      const match = txt.match(/\{[\s\S]*\}/);
      if (match) aiResult = JSON.parse(match[0]);
      else {
        debugError('No JSON object found in extracted text', { txt, fullResponse: j });
        throw new Error('Format respons tidak valid');
      }
    } catch (e) {
      debugError('runAI (foreign flow) failed', e);
      aiError = e.message;
    } finally {
      aiLoading = false;
    }
  }

  // Otomatis jalankan analisis AI begitu hasil parsing PDF siap.
  $effect(() => {
    if (result?.rows?.length) runAI();
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

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Kode</th><th>Avg Price</th><th>Net Value</th>
            <th>Net Buy Vol</th><th>Sell Vol</th><th>Buy Vol</th>
          </tr>
        </thead>
        <tbody>
          {#each result.rows as r}
            <tr>
              <td class="mono">{r.no}</td>
              <td class="mono code">{r.code}</td>
              <td class="mono">{idr(r.avgPrice)}</td>
              <td class="mono bull">{r.netForeignValue.toLocaleString()}</td>
              <td class="mono">{volFmt(r.netForeignBuyVolume)}</td>
              <td class="mono">{volFmt(r.foreignSellVolume)}</td>
              <td class="mono">{volFmt(r.foreignBuyVolume)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="ai-block">
      <div class="ai-header">
        <div class="alabel">ANALISIS AI{aiModel ? ` · ${modelLabel}` : ''}</div>
        {#if !aiLoading}
          <button class="rerun-btn" onclick={runAI}>↻ Jalankan Ulang</button>
        {/if}
      </div>

      {#if aiLoading}
        <div class="empty small">
          <div class="empty-icon pulse">◈</div>
          <div class="empty-sub">AI sedang memilih saham paling menarik...</div>
        </div>
      {:else if aiError}
        <div class="err">⚠ {aiError}</div>
      {:else if aiResult}
        <div class="acard">
          <p class="atext">{aiResult.ringkasan}</p>
        </div>
        {#if aiResult.pilihan?.length}
          <div class="picks">
            {#each aiResult.pilihan as p}
              <div class="pick">
                <span class="pick-code mono">{p.code}</span>
                <span class="pick-reason">{p.alasan}</span>
              </div>
            {/each}
          </div>
        {/if}
        <div class="disc">⚠ Analisis AI bukan saran investasi profesional. Selalu lakukan riset mandiri.</div>
      {/if}
    </div>
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
.empty.small { padding:24px; }
.empty-icon  { font-size:46px; opacity:.3; margin-bottom:14px; }
.empty-title { font-size:15px; color:var(--text); margin-bottom:6px; }
.empty-sub   { font-size:12px; }
.spin  { display:inline-block; animation:spin 1.2s linear infinite; }
.pulse { animation:pulse 1.6s ease infinite; }

.stats-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.stat      { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; text-align:center; }
.stat-val  { font-size:20px; font-weight:800; }
.stat-label{ font-size:10px; color:var(--muted); margin-top:4px; }

.table-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th    { text-align:right; padding:8px 10px; color:var(--muted); font-size:10px; letter-spacing:.5px;
        border-bottom:1px solid var(--border); white-space:nowrap; background:var(--card); }
th:nth-child(1), th:nth-child(2) { text-align:left; }
td    { text-align:right; padding:7px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
td:nth-child(1), td:nth-child(2) { text-align:left; }
tbody tr:last-child td { border-bottom:none; }
tbody tr:hover { background:var(--card); }
.code  { color:var(--accent); font-weight:800; }

.ai-block  { display:flex; flex-direction:column; gap:10px; }
.ai-header { display:flex; align-items:center; justify-content:space-between; }
.rerun-btn { background:transparent; border:1px solid var(--border); border-radius:6px; padding:5px 10px;
             color:var(--muted); font-size:11px; }
.rerun-btn:hover { color:var(--text); border-color:var(--accent); }
.acard  { background:var(--card); border-radius:8px; padding:12px 16px; }
.alabel { font-size:9px; color:var(--muted); letter-spacing:1.5px; }
.atext  { color:var(--text); font-size:13px; line-height:1.75; }
.picks  { display:flex; flex-direction:column; gap:6px; }
.pick   { display:flex; gap:10px; align-items:baseline; background:var(--card); border-radius:6px; padding:8px 10px; }
.pick-code   { color:var(--accent); font-weight:800; min-width:56px; }
.pick-reason { font-size:12px; color:var(--text); }
.disc   { font-size:10px; color:var(--muted); text-align:center; }
.bull   { color:var(--bull); }
.mono   { font-family:monospace; }
@keyframes spin  { to { transform:rotate(360deg); } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
</style>
