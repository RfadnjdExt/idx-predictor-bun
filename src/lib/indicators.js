export function sma(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    return arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
  });
}

export function ema(arr, n) {
  const k = 2 / (n + 1);
  const out = Array(arr.length).fill(null);
  if (arr.length < n) return out;
  out[n - 1] = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < arr.length; i++) out[i] = arr[i] * k + out[i - 1] * (1 - k);
  return out;
}

export function bollinger(arr, n = 20) {
  const mid = sma(arr, n);
  return arr.map((_, i) => {
    if (!mid[i]) return { u: null, m: null, l: null };
    const sl = arr.slice(i - n + 1, i + 1);
    const std = Math.sqrt(sl.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / n);
    return { u: mid[i] + 2 * std, m: mid[i], l: mid[i] - 2 * std };
  });
}

export function calcMACD(arr) {
  const e12 = ema(arr, 12), e26 = ema(arr, 26);
  const ml = arr.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null);
  const k = 2 / 10, ms = Array(arr.length).fill(null);
  let prev = null, cnt = 0, sum = 0;
  for (let i = 0; i < ml.length; i++) {
    if (ml[i] == null) continue;
    if (cnt < 9) { sum += ml[i]; cnt++; if (cnt === 9) { ms[i] = sum / 9; prev = ms[i]; } }
    else { ms[i] = ml[i] * k + prev * (1 - k); prev = ms[i]; }
  }
  return { ml, ms, mh: ml.map((v, i) => v != null && ms[i] != null ? v - ms[i] : null) };
}

export function calcRSI(arr, n = 14) {
  const out = Array(arr.length).fill(null);
  for (let i = n; i < arr.length; i++) {
    const ch = arr.slice(i - n, i + 1).map((v, j, a) => j > 0 ? v - a[j - 1] : 0).slice(1);
    const g = ch.filter(c => c > 0).reduce((a, b) => a + b, 0) / n;
    const l = ch.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
