<script>
  import { idr, fmt } from '$lib/format.js';

  let { stock, signals = [] } = $props();

  let aiResult  = $state(null);
  let aiLoading = $state(false);
  let aiError   = $state(null);

  let rc = $derived(aiResult?.rec === 'BUY' ? '#00e676' : aiResult?.rec === 'SELL' ? '#ff3d57' : '#ffd740');
  let rl = $derived(aiResult?.rec === 'BUY' ? '◆ BELI'  : aiResult?.rec === 'SELL' ? '◆ JUAL'  : '◆ TAHAN');

  async function runAI() {
    if (!stock) return;
    aiLoading = true; aiError = null;
    try {
      const s    = stock;
      const last = s.data.at(-1);
      const last5 = s.data.slice(-5).map(d => `${d.ds}:${idr(d.close)}`).join(', ');
      const sigs5 = signals.slice(-5).map(sg => `${sg.type}-${sg.label}`).join('; ') || 'Tidak ada';

      const prompt =
        `Kamu analis saham profesional Indonesia. Analisis saham IDX ini:\n\n` +
        `SAHAM: ${s.ticker} (${s.name})\nHARGA: ${idr(s.price)} (${s.changePct.toFixed(2)}%)\n\n` +
        `INDIKATOR TEKNIKAL:\n` +
        `MA5=${idr(last.ma5)} MA20=${idr(last.ma20)} MA50=${idr(last.ma50)}\n` +
        `RSI=${fmt(last.rsi,1)} MACD=${fmt(last.ml)} Signal=${fmt(last.ms)} Hist=${fmt(last.mh)}\n` +
        `BB Upper=${idr(last.bb_u)} Mid=${idr(last.bb_m)} Lower=${idr(last.bb_l)}\n\n` +
        `5 HARI TERAKHIR: ${last5}\nSINYAL: ${sigs5}\n\n` +
        `Balas HANYA JSON (tanpa backtick):\n` +
        `{"rec":"BUY|HOLD|SELL","confidence":0-100,"target":number,"stoploss":number,` +
        `"horizon":"singkat","analisis":"2-3 kalimat","poin":["p1","p2","p3"],"risiko":"Rendah|Sedang|Tinggi"}`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      });
      const j     = await r.json();
      const txt   = j.content?.[0]?.text ?? '';
      const match = txt.match(/\{[\s\S]*\}/);
      if (match) aiResult = JSON.parse(match[0]);
      else throw new Error('Format respons tidak valid');
    } catch(e) {
      aiError = e.message;
    } finally {
      aiLoading = false;
    }
  }
</script>

<div class="panel">
  <div class="header">
    <div>
      <div class="title">PREDIKSI AI · CLAUDE claude-sonnet-4-6</div>
      <div class="sub">Analisis berbasis indikator teknikal dengan Claude AI</div>
    </div>
    <button class="run-btn" onclick={runAI} disabled={aiLoading}>
      {#if aiLoading}<span class="spin">◈</span> Menganalisis...
      {:else}✦ Jalankan Analisis AI{/if}
    </button>
  </div>

  {#if aiError}
    <div class="err">⚠ {aiError}</div>
  {/if}

  {#if !aiResult && !aiLoading && !aiError}
    <div class="empty">
      <div class="empty-icon">◈</div>
      <div class="empty-title">Siap Menganalisis {stock?.ticker}</div>
      <div class="empty-sub">Klik tombol untuk prediksi harga berbasis AI + indikator teknikal</div>
    </div>
  {:else if aiLoading}
    <div class="empty">
      <div class="empty-icon pulse">◈</div>
      <div class="empty-title">Memproses {stock?.data?.length} hari data historis...</div>
      <div class="empty-sub">AI sedang menganalisis MA, RSI, MACD, dan Bollinger Bands</div>
    </div>
  {:else if aiResult}
    {@const tPct  = (((aiResult.target   - stock.price) / stock.price) * 100).toFixed(1)}
    {@const slPct = (((aiResult.stoploss - stock.price) / stock.price) * 100).toFixed(1)}

    <div class="rec-box" style="border-color:{rc}">
      <div class="rec-label">REKOMENDASI AI</div>
      <div class="rec-val mono" style="color:{rc}">{rl}</div>
      <div class="rec-meta">
        Keyakinan: <strong>{aiResult.confidence}%</strong> ·
        Risiko: <strong>{aiResult.risiko}</strong> ·
        {aiResult.horizon}
      </div>
    </div>

    <div class="targets">
      <div class="tcard">
        <div class="tlabel">Harga Saat Ini</div>
        <div class="tval mono">{idr(stock.price)}</div>
      </div>
      <div class="tcard tcard-buy">
        <div class="tlabel">🎯 Target</div>
        <div class="tval mono bull">{idr(aiResult.target)}</div>
        <div class="tpct bull">+{tPct}%</div>
      </div>
      <div class="tcard tcard-sell">
        <div class="tlabel">🛑 Stop Loss</div>
        <div class="tval mono bear">{idr(aiResult.stoploss)}</div>
        <div class="tpct bear">{slPct}%</div>
      </div>
    </div>

    <div class="acard">
      <div class="alabel">ANALISIS</div>
      <p class="atext">{aiResult.analisis}</p>
    </div>

    {#if aiResult.poin?.length}
      <div class="acard">
        <div class="alabel">POIN KUNCI</div>
        {#each aiResult.poin as p}
          <div class="kpoint"><span class="arrow">▸</span><span>{p}</span></div>
        {/each}
      </div>
    {/if}

    <div class="disc">⚠ Analisis AI bukan saran investasi profesional. Selalu lakukan riset mandiri.</div>
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
.err     { background:rgba(255,61,87,.1); border:1px solid var(--bear); border-radius:8px; padding:10px; color:var(--bear); font-size:13px; }
.empty   { text-align:center; padding:60px; color:var(--muted); }
.empty-icon  { font-size:46px; opacity:.3; margin-bottom:14px; }
.empty-title { font-size:15px; color:var(--text); margin-bottom:6px; }
.empty-sub   { font-size:12px; }
.spin  { display:inline-block; animation:spin 1.2s linear infinite; }
.pulse { animation:pulse 1.6s ease infinite; }
.rec-box   { text-align:center; padding:22px; border-radius:10px; background:var(--card); border:2px solid; }
.rec-label { font-size:9px; color:var(--muted); letter-spacing:2px; margin-bottom:8px; }
.rec-val   { font-size:44px; font-weight:900; letter-spacing:4px; margin-bottom:8px; }
.rec-meta  { font-size:12px; color:var(--muted); }
.targets  { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.tcard    { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; text-align:center; }
.tcard-buy  { background:rgba(0,230,118,.07); border-color:rgba(0,230,118,.25); }
.tcard-sell { background:rgba(255,61,87,.07);  border-color:rgba(255,61,87,.25); }
.tlabel   { font-size:10px; color:var(--muted); margin-bottom:4px; }
.tval     { font-size:15px; font-weight:800; }
.tpct     { font-size:10px; margin-top:3px; }
.acard  { background:var(--card); border-radius:8px; padding:12px 16px; }
.alabel { font-size:9px; color:var(--muted); letter-spacing:1.5px; margin-bottom:8px; }
.atext  { color:var(--text); font-size:13px; line-height:1.75; }
.kpoint { display:flex; gap:8px; margin-bottom:7px; font-size:12px; color:var(--text); }
.arrow  { color:var(--accent); min-width:14px; flex-shrink:0; }
.disc   { font-size:10px; color:var(--muted); text-align:center; }
.bull   { color:var(--bull); }
.bear   { color:var(--bear); }
.mono   { font-family:monospace; }
@keyframes spin  { to { transform:rotate(360deg); } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
</style>
