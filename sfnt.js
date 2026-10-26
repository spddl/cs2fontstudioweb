"use strict";
// Just enough of the OpenType format: read the names, weight and slant of the faces in a .ttf/.otf/.ttc, and rewrite the
// name table of a single font so that every file of a family carries the same family name (fontconfig groups faces by it).

const SFNT = (() => {
  const tag = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  const SFNT_TAGS = new Set(["\0\x01\0\0", "OTTO", "true", "typ1"]);

  // kind of font file: "sfnt", "ttc", "woff", "woff2" or ""
  function kind(bytes) {
    if (bytes.byteLength < 12) return "";
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), t = tag(v, 0);
    if (t === "ttcf") return "ttc";
    if (t === "wOFF") return "woff";
    if (t === "wOF2") return "woff2";
    return SFNT_TAGS.has(t) ? "sfnt" : "";
  }

  function tables(v, at) {
    const n = v.getUint16(at + 4), out = {};
    if (at + 12 + n * 16 > v.byteLength) throw new Error("broken font file");
    for (let i = 0; i < n; i++) {
      const r = at + 12 + i * 16;
      out[tag(v, r)] = { checksum: v.getUint32(r + 4), offset: v.getUint32(r + 8), length: v.getUint32(r + 12) };
    }
    return out;
  }

  const MAC_ROMAN_HI = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
  // name records: [{platform, encoding, language, id, text}]
  function readNames(v, t) {
    if (!t || t.offset + 6 > v.byteLength) return [];
    const base = t.offset, count = v.getUint16(base + 2), strings = base + v.getUint16(base + 4), out = [];
    for (let i = 0; i < count; i++) {
      const r = base + 6 + i * 12;
      if (r + 12 > v.byteLength) break;
      const platform = v.getUint16(r), encoding = v.getUint16(r + 2), language = v.getUint16(r + 4), id = v.getUint16(r + 6);
      const len = v.getUint16(r + 8), off = strings + v.getUint16(r + 10);
      if (off + len > v.byteLength) continue;
      let text = "";
      if (platform === 0 || platform === 3) for (let j = 0; j + 1 < len; j += 2) text += String.fromCharCode(v.getUint16(off + j));
      else if (platform === 1 && encoding === 0) for (let j = 0; j < len; j++) { const c = v.getUint8(off + j); text += c < 128 ? String.fromCharCode(c) : MAC_ROMAN_HI[c - 128] }
      else continue;
      out.push({ platform, encoding, language, id, text });
    }
    return out;
  }
  // the best record for a name id: Windows English, any Windows/Unicode, Mac
  function pick(names, id) {
    const l = names.filter(n => n.id === id && n.text);
    const rank = n => n.platform === 3 && n.language === 0x409 ? 0 : n.platform === 3 ? 1 : n.platform === 0 ? 2 : 3;
    return l.sort((a, b) => rank(a) - rank(b))[0]?.text || "";
  }

  function face(v, at, index) {
    const t = tables(v, at), names = readNames(v, t.name);
    const os2 = t["OS/2"], head = t.head;
    let weight = 400, italic = false;
    if (os2 && os2.length >= 64) {
      weight = v.getUint16(os2.offset + 4) || 400;
      italic = !!(v.getUint16(os2.offset + 62) & 0x201); // ITALIC or OBLIQUE
    } else if (head) italic = !!(v.getUint16(head.offset + 44) & 2);
    const family = pick(names, 1);
    return {
      index, weight, italic,
      family: pick(names, 16) || family,  // the typographic family groups all weights; fontconfig knows both names
      legacyFamily: family,
      style: pick(names, 17) || pick(names, 2),
      fullName: pick(names, 4),
      postscript: pick(names, 6),
      copyright: pick(names, 0),
      licenseUrl: pick(names, 14),
    };
  }

  // all faces in a font file (one, or several for a .ttc); throws for files that are not fonts
  function parse(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    switch (kind(bytes)) {
      case "sfnt": return [face(v, 0, 0)];
      case "ttc": {
        const n = v.getUint32(8), out = [];
        for (let i = 0; i < n && i < 64; i++) out.push(face(v, v.getUint32(12 + i * 4), i));
        return out;
      }
      case "woff": case "woff2": throw new Error("WOFF files cannot be used by the game: use the .ttf or .otf file of the font");
    }
    throw new Error("not a font file");
  }

  const WEIGHT_NAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  const styleName = (weight, italic) => {
    const w = WEIGHT_NAMES[weight] || String(weight);
    return italic ? (weight === 400 ? "Italic" : w + " Italic") : w;
  };

  function checksum(b, off, len) {
    const v = new DataView(b.buffer, b.byteOffset);
    let s = 0;
    for (let i = 0; i < len; i += 4) s = (s + v.getUint32(off + i)) >>> 0; // len is padded to 4
    return s;
  }

  // A copy of a single font (not a collection) with the given family name, style and weight: name ids 1/2/3/4/6/16/17 are
  // rewritten (Windows, English), the others (copyright, license, ...) kept; OS/2 weight, fsSelection and head.macStyle follow.
  function rename(bytes, family, weight, italic) {
    if (kind(bytes) !== "sfnt") throw new Error("only a single font can be renamed");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), t = tables(v, 0);
    const style = styleName(weight, italic), full = weight === 400 && !italic ? family : `${family} ${style}`;
    const ps = (family.replace(/[^A-Za-z0-9]/g, "") + "-" + style.replace(/[^A-Za-z0-9]/g, "")).slice(0, 63);
    const REPLACED = new Set([1, 2, 3, 4, 6, 16, 17, 21, 22]);
    const recs = readNames(v, t.name).filter(n => !REPLACED.has(n.id) && (n.platform === 3 || n.platform === 0));
    for (const [id, text] of [[1, family], [2, style], [3, `${ps};CS2FontStudio`], [4, full], [6, ps], [16, family], [17, style]])
      recs.push({ platform: 3, encoding: 1, language: 0x409, id, text });
    recs.sort((a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id);
    // name table, format 0
    const strs = recs.map(r => r.text), strBytes = strs.reduce((n, s) => n + s.length * 2, 0);
    const name = new Uint8Array(6 + recs.length * 12 + strBytes), nv = new DataView(name.buffer);
    nv.setUint16(2, recs.length); nv.setUint16(4, 6 + recs.length * 12);
    let so = 0;
    recs.forEach((r, i) => {
      const o = 6 + i * 12;
      nv.setUint16(o, r.platform); nv.setUint16(o + 2, r.encoding); nv.setUint16(o + 4, r.language); nv.setUint16(o + 6, r.id);
      nv.setUint16(o + 8, r.text.length * 2); nv.setUint16(o + 10, so);
      for (let j = 0; j < r.text.length; j++) nv.setUint16(6 + recs.length * 12 + so + j * 2, r.text.charCodeAt(j));
      so += r.text.length * 2;
    });

    const tags = Object.keys(t).sort();
    if (!tags.includes("name")) tags.push("name"), tags.sort();
    const data = {};
    for (const k of tags) data[k] = k === "name" ? name : bytes.slice(t[k].offset, t[k].offset + t[k].length);
    if (data["OS/2"] && data["OS/2"].length >= 64) {
      const o = new DataView(data["OS/2"].buffer);
      o.setUint16(4, weight);
      let fs = o.getUint16(62) & ~0x261; // ITALIC, BOLD, REGULAR, OBLIQUE
      if (italic) fs |= 1;
      if (weight >= 700) fs |= 0x20;
      if (!italic && weight < 700) fs |= 0x40;
      o.setUint16(62, fs);
    }
    if (data.head && data.head.length >= 54) {
      const h = new DataView(data.head.buffer);
      h.setUint16(44, (h.getUint16(44) & ~3) | (weight >= 700 ? 1 : 0) | (italic ? 2 : 0));
      h.setUint32(8, 0); // checkSumAdjustment, set below
    }
    // new file: header, directory, tables padded to 4 bytes
    const n = tags.length, dirLen = 12 + n * 16;
    let size = dirLen;
    for (const k of tags) size += (data[k].length + 3) & ~3;
    const out = new Uint8Array(size), ov = new DataView(out.buffer);
    ov.setUint32(0, v.getUint32(0));
    let es = 0; while ((1 << (es + 1)) <= n) es++;
    ov.setUint16(4, n); ov.setUint16(6, 16 << es); ov.setUint16(8, es); ov.setUint16(10, n * 16 - (16 << es));
    let off = dirLen, headAt = -1;
    tags.forEach((k, i) => {
      const d = data[k], r = 12 + i * 16;
      out.set(d, off);
      for (let j = 0; j < 4; j++) out[r + j] = k.charCodeAt(j);
      ov.setUint32(r + 4, checksum(out, off, (d.length + 3) & ~3));
      ov.setUint32(r + 8, off); ov.setUint32(r + 12, d.length);
      if (k === "head") headAt = off;
      off += (d.length + 3) & ~3;
    });
    if (headAt >= 0) ov.setUint32(headAt + 8, (0xB1B0AFBA - checksum(out, 0, size)) >>> 0);
    return out;
  }

  return { kind, parse, rename, styleName };
})();

if (typeof module !== "undefined") module.exports = SFNT;
