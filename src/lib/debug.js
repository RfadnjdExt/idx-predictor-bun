// Sistem logging debug kecil & bisa di-toggle, dipakai untuk melacak masalah
// respons AI (mis. "Format respons tidak valid").
//
// Cara pakai di browser console:
//   localStorage.setItem('AI_DEBUG', '1')   // aktifkan
//   localStorage.setItem('AI_DEBUG', '0')   // matikan
// Default: aktif (biar langsung kelihatan saat debugging).

const KEY = 'AI_DEBUG';

export function isDebugEnabled() {
  if (typeof localStorage === 'undefined') return true;
  const v = localStorage.getItem(KEY);
  return v === null ? true : v === '1';
}

export function debugLog(label, data) {
  if (!isDebugEnabled()) return;
  console.log(`[AI DEBUG] ${label}:`, data);
}

export function debugError(label, err) {
  if (!isDebugEnabled()) return;
  console.error(`[AI DEBUG] ${label}:`, err);
}
