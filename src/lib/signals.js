export function detectSignals(data) {
  const sigs = [];
  for (let i = 1; i < data.length; i++) {
    const c = data[i], p = data[i - 1];
    if (c.ma5 && c.ma20 && p.ma5 && p.ma20) {
      if (p.ma5 < p.ma20 && c.ma5 >= c.ma20)
        sigs.push({ i, type: 'BUY',  label: 'Golden Cross',     sub: 'MA5 melewati MA20 ke atas',      str: 3 });
      if (p.ma5 > p.ma20 && c.ma5 <= c.ma20)
        sigs.push({ i, type: 'SELL', label: 'Death Cross',      sub: 'MA5 jatuh di bawah MA20',        str: 3 });
    }
    if (p.rsi && c.rsi) {
      if (p.rsi > 30 && c.rsi <= 30)
        sigs.push({ i, type: 'BUY',  label: 'RSI Oversold',     sub: `RSI turun ke ${c.rsi.toFixed(1)}`,  str: 2 });
      if (p.rsi < 70 && c.rsi >= 70)
        sigs.push({ i, type: 'SELL', label: 'RSI Overbought',   sub: `RSI naik ke ${c.rsi.toFixed(1)}`,   str: 2 });
    }
    if (p.ml != null && p.ms != null && c.ml != null && c.ms != null) {
      if (p.ml < p.ms && c.ml >= c.ms)
        sigs.push({ i, type: 'BUY',  label: 'MACD Crossover',   sub: 'MACD melewati garis sinyal',     str: 2 });
      if (p.ml > p.ms && c.ml <= c.ms)
        sigs.push({ i, type: 'SELL', label: 'MACD Bearish',     sub: 'MACD turun di bawah sinyal',     str: 2 });
    }
    if (c.bb_l && p.close && c.close) {
      if (p.close > p.bb_l && c.close <= c.bb_l)
        sigs.push({ i, type: 'BUY',  label: 'BB Band Bawah',    sub: 'Harga menyentuh Bollinger bawah', str: 1 });
      if (p.close < p.bb_u && c.close >= c.bb_u)
        sigs.push({ i, type: 'SELL', label: 'BB Band Atas',     sub: 'Harga menyentuh Bollinger atas',  str: 1 });
    }
  }
  return sigs.slice(-16);
}
