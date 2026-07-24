/**
 * pdfReader.js
 *
 * Pembaca PDF biner dari scratch, TANPA dependency npm — hanya modul bawaan
 * Node: `zlib` (dekompresi FlateDecode). Port dari pdf-reader.ts (dihapus
 * anotasi TypeScript-nya) supaya bisa dipakai langsung di route server
 * SvelteKit tanpa perlu compile step tambahan.
 *
 * SCOPE DIPERSEMPIT khusus untuk struktur PDF "stream.pdf" (Foreign
 * Transaction Midday Data by Stockbit) yang sudah dicek langsung:
 *   - Objek PDF standar (dict, array, name, string, reference, number)
 *   - Page tree sederhana: /Pages -> /Kids -> /Page
 *   - Stream hanya pakai filter /FlateDecode
 *   - Font teks berupa composite font (/Subtype /Type0, /Encoding
 *     /Identity-H) dengan /ToUnicode berupa CMap bfrange identitas
 *     (kode 2-byte = code point Unicode langsung)
 *   - Content stream hanya pakai operator: BT/ET, Td, Tf, Tj
 *
 * TIDAK menangani (di luar cakupan file ini): enkripsi PDF, filter selain
 * FlateDecode, font 1-byte/simple font, operator TJ/Tm/'/"/predictor, atau
 * struktur page tree bertingkat.
 */

import * as zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Model objek PDF (COS)
// ---------------------------------------------------------------------------

function isDict(v) {
  return !!v && typeof v === 'object' && !('kind' in v) && !Array.isArray(v);
}
function isName(v) {
  return !!v && typeof v === 'object' && v.kind === 'name';
}
function isRef(v) {
  return !!v && typeof v === 'object' && v.kind === 'ref';
}
function nameOf(v) {
  return isName(v) ? v.name : undefined;
}

// ---------------------------------------------------------------------------
// Lexer/parser sintaks objek PDF
// ---------------------------------------------------------------------------

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

class PDFLexer {
  constructor(s, pos = 0) {
    this.s = s;
    this.pos = pos;
  }

  code(offset = 0) {
    return this.s.charCodeAt(this.pos + offset);
  }

  skipWs() {
    while (WHITESPACE.has(this.code())) this.pos++;
  }

  startsWith(kw) {
    return this.s.startsWith(kw, this.pos);
  }

  parseValue() {
    this.skipWs();
    const c = this.code();

    if (c === 0x2f) return this.parseName(); // /Name
    if (c === 0x28) return this.parseLiteralString(); // ( ... )
    if (c === 0x3c) return this.code(1) === 0x3c ? this.parseDict() : this.parseHexString();
    if (c === 0x5b) return this.parseArray(); // [ ... ]
    if (this.startsWith('true')) {
      this.pos += 4;
      return true;
    }
    if (this.startsWith('false')) {
      this.pos += 5;
      return false;
    }
    if (this.startsWith('null')) {
      this.pos += 4;
      return null;
    }
    if (c === 0x2b || c === 0x2d || c === 0x2e || (c >= 0x30 && c <= 0x39)) {
      return this.parseNumberOrRef();
    }
    this.pos++; // token tak dikenal, hindari infinite loop
    return null;
  }

  parseName() {
    this.pos++; // lewati '/'
    let out = '';
    while (this.pos < this.s.length && !WHITESPACE.has(this.code()) && !DELIMITERS.has(this.code())) {
      out += this.s[this.pos];
      this.pos++;
    }
    return { kind: 'name', name: out };
  }

  readNumber() {
    const m = /^[+-]?\d*\.?\d+/.exec(this.s.slice(this.pos));
    if (!m) throw new Error(`Angka tidak valid pada posisi ${this.pos}`);
    this.pos += m[0].length;
    return parseFloat(m[0]);
  }

  /** Angka biasa, atau kalau diikuti "<int> R" berarti indirect reference. */
  parseNumberOrRef() {
    const n1 = this.readNumber();
    if (Number.isInteger(n1) && n1 >= 0) {
      const save = this.pos;
      this.skipWs();
      if (/[0-9]/.test(this.s[this.pos] || '')) {
        this.readNumber(); // generation number, tidak dipakai
        this.skipWs();
        if (this.code() === 0x52 && !this.isRegular(this.code(1))) {
          this.pos += 1;
          return { kind: 'ref', num: n1 };
        }
      }
      this.pos = save;
    }
    return n1;
  }

  isRegular(code) {
    return !WHITESPACE.has(code) && !DELIMITERS.has(code) && !Number.isNaN(code);
  }

  parseDict() {
    this.pos += 2; // '<<'
    const dict = {};
    for (;;) {
      this.skipWs();
      if (this.startsWith('>>')) {
        this.pos += 2;
        break;
      }
      if (this.pos >= this.s.length) break;
      const key = this.parseName();
      dict[key.name] = this.parseValue();
    }
    return dict;
  }

  parseArray() {
    this.pos += 1; // '['
    const arr = [];
    for (;;) {
      this.skipWs();
      if (this.code() === 0x5d) {
        this.pos += 1;
        break;
      }
      if (this.pos >= this.s.length) break;
      arr.push(this.parseValue());
    }
    return arr;
  }

  /** String literal "(...)" -> byte mentah (unescaped), dikembalikan sebagai latin1. */
  parseLiteralString() {
    this.pos += 1; // '('
    const bytes = [];
    let depth = 1;
    const escape1 = {
      0x6e: 0x0a,
      0x72: 0x0d,
      0x74: 0x09,
      0x62: 0x08,
      0x66: 0x0c,
      0x28: 0x28,
      0x29: 0x29,
      0x5c: 0x5c,
    };
    while (this.pos < this.s.length && depth > 0) {
      const c = this.code();
      if (c === 0x5c) {
        const next = this.code(1);
        if (next in escape1) {
          bytes.push(escape1[next]);
          this.pos += 2;
        } else if (next >= 0x30 && next <= 0x37) {
          let oct = '';
          let p = this.pos + 1;
          for (let i = 0; i < 3 && this.s.charCodeAt(p) >= 0x30 && this.s.charCodeAt(p) <= 0x37; i++, p++) {
            oct += this.s[p];
          }
          bytes.push(parseInt(oct, 8) & 0xff);
          this.pos = p;
        } else {
          bytes.push(next);
          this.pos += 2;
        }
      } else if (c === 0x28) {
        depth++;
        bytes.push(c);
        this.pos++;
      } else if (c === 0x29) {
        depth--;
        this.pos++;
        if (depth > 0) bytes.push(c);
      } else {
        bytes.push(c);
        this.pos++;
      }
    }
    return Buffer.from(bytes).toString('latin1');
  }

  /** String hex "<...>" -> byte, dikembalikan sebagai latin1. */
  parseHexString() {
    this.pos += 1; // '<'
    let hex = '';
    while (this.pos < this.s.length && this.code() !== 0x3e) {
      const c = this.s[this.pos];
      if (/[0-9A-Fa-f]/.test(c)) hex += c;
      this.pos++;
    }
    this.pos++; // '>'
    if (hex.length % 2 === 1) hex += '0';
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    return Buffer.from(bytes).toString('latin1');
  }
}

// ---------------------------------------------------------------------------
// Pemindaian objek PDF langsung dari body file
// ---------------------------------------------------------------------------

function loadObjects(buffer) {
  const latin1 = buffer.toString('latin1');
  const objects = new Map();
  const objRegex = /(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj\b/g;
  let m;

  while ((m = objRegex.exec(latin1))) {
    const num = parseInt(m[1], 10);
    const lexer = new PDFLexer(latin1, objRegex.lastIndex);
    const value = lexer.parseValue();
    lexer.skipWs();

    let rawStream;
    if (lexer.startsWith('stream')) {
      let sPos = lexer.pos + 'stream'.length;
      if (buffer[sPos] === 0x0d && buffer[sPos + 1] === 0x0a) sPos += 2;
      else if (buffer[sPos] === 0x0a) sPos += 1;

      const endIdx = buffer.indexOf('endstream', sPos, 'latin1');
      let dataEnd = endIdx === -1 ? buffer.length : endIdx;
      while (dataEnd > sPos && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) dataEnd--;
      rawStream = buffer.subarray(sPos, dataEnd);

      objRegex.lastIndex = endIdx === -1 ? latin1.length : endIdx + 'endstream'.length;
    }
    objects.set(num, { num, value, rawStream });
  }
  return objects;
}

function resolve(objects, v) {
  if (isRef(v)) {
    const obj = objects.get(v.num);
    return obj ? obj.value : null;
  }
  return v;
}

function getStreamData(objects, obj) {
  if (!obj.rawStream) return Buffer.alloc(0);
  const dict = obj.value;
  if (isDict(dict) && nameOf(dict['Filter']) === 'FlateDecode') {
    return zlib.inflateSync(obj.rawStream);
  }
  return obj.rawStream; // tanpa filter
}

// ---------------------------------------------------------------------------
// Page tree: /Pages -> /Kids -> /Page (asumsi satu tingkat, sesuai file ini)
// ---------------------------------------------------------------------------

function collectPages(objects) {
  const pages = [];
  const pagesRoot = [...objects.values()].find(
    (o) => isDict(o.value) && nameOf(o.value['Type']) === 'Pages'
  );
  if (!pagesRoot) return pages;

  const kids = pagesRoot.value['Kids'];
  if (!Array.isArray(kids)) return pages;

  for (const kidRef of kids) {
    if (isRef(kidRef)) {
      const kidObj = objects.get(kidRef.num);
      if (kidObj && isDict(kidObj.value) && nameOf(kidObj.value['Type']) === 'Page') {
        pages.push(kidObj);
      }
    }
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Font: /ToUnicode CMap (bfrange) untuk font composite Identity-H
// ---------------------------------------------------------------------------

/** Parse blok bfrange dari CMap /ToUnicode: "<lo> <hi> <dst>" per baris. */
function parseToUnicodeCMap(text) {
  const map = new Map();
  const blocks = text.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
  for (const block of blocks) {
    const entryRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m;
    while ((m = entryRegex.exec(block))) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      const dstLo = parseInt(m[3], 16);
      for (let code = lo; code <= hi; code++) map.set(code, dstLo + (code - lo));
    }
  }
  return map;
}

function buildFontMap(objects, page) {
  const fonts = new Map();
  const resources = resolve(objects, page.value['Resources']);
  if (!isDict(resources)) return fonts;
  const fontDict = resolve(objects, resources['Font']);
  if (!isDict(fontDict)) return fonts;

  for (const [fname, ref] of Object.entries(fontDict)) {
    if (!isRef(ref)) continue;
    const fontObj = objects.get(ref.num);
    if (!fontObj || !isDict(fontObj.value)) continue;
    const tuRef = fontObj.value['ToUnicode'];
    if (isRef(tuRef)) {
      const tuObj = objects.get(tuRef.num);
      if (tuObj) fonts.set(fname, parseToUnicodeCMap(getStreamData(objects, tuObj).toString('latin1')));
    }
  }
  return fonts;
}

/** Decode string 2-byte-per-karakter (Identity-H) lewat peta /ToUnicode. */
function decodeText(raw, cmap) {
  const bytes = Buffer.from(raw, 'latin1');
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = (bytes[i] << 8) | bytes[i + 1];
    out += String.fromCharCode(cmap?.get(code) ?? code);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content stream: hanya operator BT/ET, Td, Tf, Tj
// ---------------------------------------------------------------------------

function extractTextChunks(content, fonts) {
  const latin1 = content.toString('latin1');
  const lexer = new PDFLexer(latin1, 0);
  const chunks = [];

  let curX = 0;
  let curY = 0;
  let curFont;
  const stack = [];
  const num = (v) => (typeof v === 'number' ? v : 0);

  while (lexer.pos < latin1.length) {
    lexer.skipWs();
    if (lexer.pos >= latin1.length) break;
    const c = latin1.charCodeAt(lexer.pos);

    if (c === 0x2f || c === 0x28 || c === 0x3c || c === 0x5b || c === 0x2b || c === 0x2d || c === 0x2e || (c >= 0x30 && c <= 0x39)) {
      stack.push(lexer.parseValue());
      continue;
    }

    const start = lexer.pos;
    while (lexer.pos < latin1.length && !WHITESPACE.has(latin1.charCodeAt(lexer.pos)) && !DELIMITERS.has(latin1.charCodeAt(lexer.pos))) {
      lexer.pos++;
    }
    if (lexer.pos === start) {
      lexer.pos++;
      continue;
    }
    const op = latin1.slice(start, lexer.pos);

    if (op === 'BT') {
      curX = 0;
      curY = 0;
    } else if (op === 'Td') {
      curX += num(stack[stack.length - 2]);
      curY += num(stack[stack.length - 1]);
    } else if (op === 'Tf') {
      const fNameVal = stack[stack.length - 2];
      const fName = isName(fNameVal) ? fNameVal.name : undefined;
      curFont = fName ? fonts.get(fName) : undefined;
    } else if (op === 'Tj') {
      const str = stack[stack.length - 1];
      if (typeof str === 'string') {
        const text = decodeText(str, curFont);
        if (text) chunks.push({ x: curX, y: curY, text });
      }
    }
    stack.length = 0;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Susun ulang baris dari posisi (x, y)
// ---------------------------------------------------------------------------

function chunksToLines(chunks, yTolerance = 2) {
  const sorted = [...chunks].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const c of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - c.y) <= yTolerance);
    if (row) row.push(c);
    else rows.push([c]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = '';
    let prevEndX = null;
    for (const c of row) {
      if (prevEndX !== null && c.x - prevEndX > 3) line += ' ';
      line += c.text;
      prevEndX = c.x + c.text.length * 4; // estimasi kasar lebar teks
    }
    return line;
  });
}

// ---------------------------------------------------------------------------
// Parsing baris tabel menjadi data terstruktur
// ---------------------------------------------------------------------------

// Urutan kolom: No, Code, AvgPrice, NetForeignValue, NetForeignBuyVolume,
// ForeignSellVolume, ForeignBuyVolume — sesuai tabel di file ini.
const ROW_REGEX =
  /^(\d+)\s+([A-Z0-9]+)\s+([\d,]+)\s+(-?[\d.]+[KMB]?)\s+(-?[\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/;

function parseCommaNumber(raw) {
  return Number(raw.replace(/,/g, ''));
}

function parseSuffixNumber(raw) {
  const m = raw.trim().match(/^(-?[\d.]+)\s*([KMB])?$/i);
  if (!m) return NaN;
  const value = parseFloat(m[1]);
  const suffix = (m[2] || '').toUpperCase();
  const mult = suffix === 'B' ? 1_000_000_000 : suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1;
  return value * mult;
}

/** Parse seluruh baris (lintas halaman) menjadi ForeignRow; baris judul/footnote yang tidak cocok pola dilewati. */
export function parseForeignRows(pagesLines) {
  const rows = [];
  for (const lines of pagesLines) {
    for (const line of lines) {
      const m = line.trim().match(ROW_REGEX);
      if (!m) continue;
      const [, no, code, avgPrice, netValue, netBuyVol, sellVol, buyVol] = m;
      rows.push({
        no: parseInt(no, 10),
        code,
        avgPrice: parseCommaNumber(avgPrice),
        netForeignValue: parseSuffixNumber(netValue),
        netForeignBuyVolume: parseCommaNumber(netBuyVol),
        foreignSellVolume: parseCommaNumber(sellVol),
        foreignBuyVolume: parseCommaNumber(buyVol),
      });
    }
  }
  return rows;
}

/** Filter: hanya saham yang net BUY oleh asing (netForeignBuyVolume > 0). */
export function filterNetBuyOnly(rows) {
  return rows.filter((r) => r.netForeignBuyVolume > 0);
}

/** Urutkan dari harga (avgPrice) termurah ke termahal. */
export function sortByCheapestPrice(rows) {
  return [...rows].sort((a, b) => a.avgPrice - b.avgPrice);
}

/** Ambil setengah teratas dari daftar (asumsi daftar sudah terurut termurah -> termahal). */
export function takeCheaperHalf(rows) {
  return rows.slice(0, Math.ceil(rows.length / 2));
}

/** Urutkan dari volume beli asing (foreignBuyVolume) terbanyak ke tersedikit. */
export function sortByHighestBuyVolume(rows) {
  return [...rows].sort((a, b) => b.foreignBuyVolume - a.foreignBuyVolume);
}

// ---------------------------------------------------------------------------
// API utama
// ---------------------------------------------------------------------------

export function readPdfText(buffer) {
  const objects = loadObjects(buffer);
  const pages = collectPages(objects);

  return pages.map((page) => {
    const fonts = buildFontMap(objects, page);
    const contentRef = page.value['Contents'];
    const contentObj = isRef(contentRef) ? objects.get(contentRef.num) : undefined;
    const content = contentObj ? getStreamData(objects, contentObj) : Buffer.alloc(0);
    const chunks = extractTextChunks(content, fonts);
    return chunksToLines(chunks);
  });
}

/** Pipeline lengkap: buffer PDF -> baris ForeignRow siap pakai, sudah difilter+diurutkan. */
export function analyzeForeignFlowPdf(buffer) {
  const pagesLines = readPdfText(buffer);
  const allRows = parseForeignRows(pagesLines);
  const buyRows = filterNetBuyOnly(allRows);
  const sortedRows = sortByCheapestPrice(buyRows);
  const halfRows = takeCheaperHalf(sortedRows);
  const finalRows = sortByHighestBuyVolume(halfRows);

  return {
    totalRows: allRows.length,
    netBuyCount: buyRows.length,
    cheaperHalfCount: halfRows.length,
    rows: finalRows,
  };
}
