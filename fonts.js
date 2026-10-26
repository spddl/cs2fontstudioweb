"use strict";
// Where the fonts come from. Every font is one family with faces (weight, italic):
//  google: the Google Fonts catalog through Fontsource (static .ttf per weight, style and character subset, on jsDelivr)
//  file:   .ttf/.otf/.ttc files the user uploaded, or downloaded from a URL (kept in the browser, IndexedDB)
//  local:  fonts installed on this PC (Local Font Access API, Chrome/Edge)
// The preview loads woff2 (Google) or the file itself; the zip gets .ttf/.otf/.ttc files the game can read.

const FONTS = (() => {
  const API = "https://api.fontsource.org/v1/fonts";
  const CDN = id => `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/`;
  const LIST_KEY = "fontsource-list-v1", LIST_TTL = 24 * 3600e3;
  // character subsets that go into the zip: the scripts of player names and chat; CJK, Thai and the rest come from the
  // game's own Noto fonts (fontconfig falls back per character)
  const ZIP_SUBSETS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"];
  const SRC = new Map();      // lower-case family -> source
  const listeners = new Set();
  const changed = () => listeners.forEach(f => f());
  const lc = s => s.toLowerCase();

  // ---- Google Fonts (Fontsource)
  let googleCount = 0;
  async function loadGoogle() {
    let list = null;
    try {
      const c = JSON.parse(localStorage.getItem(LIST_KEY));
      if (c && Date.now() - c.t < LIST_TTL && Array.isArray(c.list)) list = c.list;
    } catch {}
    if (!list) {
      const r = await fetch(API + "?type=google");
      if (!r.ok) throw new Error("the Google Fonts list could not be loaded (" + r.status + ")");
      list = (await r.json()).map(x => [x.id, x.family, x.weights, x.styles, x.category, x.license]);
      try { localStorage.setItem(LIST_KEY, JSON.stringify({ t: Date.now(), list })) } catch {}
    }
    googleCount = 0;
    for (const [id, family, weights, styles, category, license] of list) {
      if (category === "icons") continue; // symbols, not text
      googleCount++;
      const s = SRC.get(lc(family)), g = { kind: "google", family, id, weights, styles, category, license };
      if (!s) SRC.set(lc(family), g);
      else if (s.kind === "file") s.google = g; // an own file of the same name stays in front
    }
    changed();
  }
  const details = new Map();
  function detail(s) {
    if (!details.has(s.id)) {
      const p = fetch(API + "/" + encodeURIComponent(s.id)).then(r => {
        if (!r.ok) throw new Error(`${s.family}: font details could not be loaded (${r.status})`);
        return r.json();
      });
      p.catch(() => details.delete(s.id));
      details.set(s.id, p);
    }
    return details.get(s.id);
  }

  // ---- files (upload, URL, zip, IndexedDB)
  const DB = "cs2fontstudio", STORE = "files";
  function db() {
    return new Promise((ok, fail) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "key" });
        r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
      } catch (e) { fail(e) }
    });
  }
  async function dbDo(mode, fn) {
    const d = await db();
    return new Promise((ok, fail) => {
      const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(req?.result); t.onerror = () => fail(t.error);
    });
  }
  const faceKey = f => `${f.weight}|${f.italic ? 1 : 0}`;

  // registers the font files (records {key, file, bytes, origin, url}); returns the families they hold
  function register(recs) {
    const fams = new Set();
    for (const rec of recs) {
      let faces;
      try { faces = SFNT.parse(rec.bytes) } catch { continue }
      for (const f of faces) {
        if (!f.family) continue;
        const k = lc(f.family);
        let s = SRC.get(k);
        if (!s || s.kind !== "file") { // own files win over a Google font of the same name (back when they are removed)
          s = { kind: "file", family: f.family, category: "mine", faces: [], keys: new Set(), origin: rec.origin, url: rec.url, google: s?.kind === "google" ? s : null };
          SRC.set(k, s);
        }
        if (!s.faces.some(x => x.rec.key === rec.key && x.index === f.index)) s.faces.push({ weight: f.weight, italic: f.italic, index: f.index, rec, copyright: f.copyright });
        s.keys.add(rec.key);
        fams.add(f.family);
      }
    }
    if (fams.size) changed();
    return [...fams];
  }
  async function restoreFiles() {
    try { register(await dbDo("readonly", s => s.getAll()) || []) } catch {}
  }
  // [{name, bytes}] -> {families, skipped: [{name, why}]}; zips are opened, fonts in them added
  async function addFiles(files, origin = "upload", url = "") {
    const recs = [], skipped = [];
    const add = async (name, bytes) => {
      if (/\.zip$/i.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        let entries;
        try { entries = ZIP.read(bytes) } catch (e) { skipped.push({ name, why: e.message }); return }
        for (const e of entries) if (/\.(ttf|otf|ttc)$/i.test(e.name) && e.size < 64 << 20) await add(e.name.split("/").pop(), await e.read());
        return;
      }
      try { SFNT.parse(bytes) } catch (e) { skipped.push({ name, why: e.message }); return }
      recs.push({ key: `${name}|${bytes.length}|${ZIP.crc32(bytes)}`, file: name, bytes, origin, url });
    };
    for (const f of files) await add(f.name, f.bytes);
    const families = register(recs);
    try { await dbDo("readwrite", s => { for (const r of recs) s.put(r) }) } catch {} // private window: kept for this visit only
    return { families, skipped };
  }
  async function addUrl(url) {
    let r;
    try { r = await fetch(url) }
    catch { throw new Error("the server does not allow downloads from a web page (CORS). Download the file and upload it instead.") }
    if (!r.ok) throw new Error(`download failed (${r.status})`);
    const name = decodeURIComponent(new URL(r.url || url).pathname.split("/").pop() || "font.ttf");
    return addFiles([{ name, bytes: new Uint8Array(await r.arrayBuffer()) }], "url", url);
  }
  async function removeFamily(family) {
    const s = SRC.get(lc(family));
    if (!s || s.kind !== "file") return;
    SRC.delete(lc(family));
    // a file can hold other families too (a .ttc): delete it only when none of them is left
    const still = new Set([...SRC.values()].filter(x => x.kind === "file").flatMap(x => [...x.keys]));
    try { await dbDo("readwrite", st => { for (const k of s.keys) if (!still.has(k)) st.delete(k) }) } catch {}
    if (s.google) SRC.set(lc(family), s.google);
    changed();
  }

  // ---- fonts installed on this PC
  const hasLocalApi = typeof window !== "undefined" && "queryLocalFonts" in window;
  async function useLocal() {
    const list = await window.queryLocalFonts();
    let n = 0;
    for (const fd of list) {
      const k = lc(fd.family);
      let s = SRC.get(k);
      if (s && s.kind !== "local") continue; // a Google font or an own file of the same name wins
      if (!s) { s = { kind: "local", family: fd.family, category: "pc", faces: [] }; SRC.set(k, s); n++ }
      s.faces.push({ fd, weight: /bold|black|heavy/i.test(fd.style) ? 700 : 400, italic: /italic|oblique/i.test(fd.style) });
    }
    changed();
    return n;
  }
  // without asking again: only when the permission was given on an earlier visit
  async function useLocalIfGranted() {
    if (!hasLocalApi) return;
    try { if ((await navigator.permissions.query({ name: "local-fonts" })).state === "granted") await useLocal() } catch {}
  }

  // ---- lookups
  const get = name => SRC.get(lc(name || ""));
  const ORDER = { file: 0, local: 1, google: 2 };
  function names() {
    return [...SRC.values()].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (lc(a.family) < lc(b.family) ? -1 : 1)).map(s => s.family);
  }
  const hasItalic = name => {
    const s = get(name);
    return !!s && (s.kind === "google" ? s.styles.includes("italic") : s.faces.some(f => f.italic));
  };
  // category for the picker filter
  const category = name => get(name)?.category || "";
  const tag = name => ({ file: get(name)?.origin === "url" ? "URL" : "uploaded", local: "this PC" })[get(name)?.kind] || "";

  // ---- preview
  const nearest = (want, have) => have.reduce((b, w) => Math.abs(w - want) < Math.abs(b - want) || (Math.abs(w - want) === Math.abs(b - want) && (want > 400 ? w > b : w < b)) ? w : b, have[0]);
  // light preview for the picker list: one face, Latin only
  const pv = new Map();
  function previewFamily(name) {
    const s = get(name);
    if (!s) return Promise.resolve(null);
    if (s.kind === "local") return Promise.resolve(`"${s.family}"`); // installed: the browser has it
    if (pv.has(name)) return pv.get(name);
    let p;
    if (s.kind === "google") {
      const w = nearest(400, s.weights), st = s.styles.includes("normal") ? "normal" : s.styles[0];
      p = new FontFace("pv:" + s.family, `url("${CDN(s.id)}latin-${w}-${st}.woff2")`, { weight: "100 900" }).load()
        .then(f => { document.fonts.add(f); return `"pv:${s.family}"` }, () => null);
    } else p = ensureFull(name).then(ok => ok ? `"full:${s.family}"` : null);
    pv.set(name, p);
    return p;
  }
  // every face, for the preview of the stage: family "full:<name>"
  const full = new Map();
  function ensureFull(name) {
    const s = get(name);
    if (!s) return Promise.resolve(false);
    if (s.kind === "local") return Promise.resolve(false); // the browser uses the installed font by its name
    const key = s.kind + ":" + s.family;
    if (full.has(key)) return full.get(key);
    const fam = "full:" + s.family;
    let p;
    if (s.kind === "google") {
      // all faces and subsets, each with its unicode-range: the browser downloads only what the text needs
      p = detail(s).then(d => {
        let n = 0;
        for (const [w, styles] of Object.entries(d.variants || {}))
          for (const [st, subsets] of Object.entries(styles))
            for (const [sub, v] of Object.entries(subsets)) {
              if (!v?.url?.woff2) continue;
              const range = d.unicodeRange?.[sub] || d.unicodeRange?.[`[${sub}]`];
              document.fonts.add(new FontFace(fam, `url("${v.url.woff2}")`, { weight: w, style: st, ...(range ? { unicodeRange: range } : {}) }));
              n++;
            }
        return n > 0;
      }).catch(() => false);
    } else {
      p = Promise.all(s.faces.map(f => {
        if (SFNT.kind(f.rec.bytes) !== "sfnt") return false; // browsers cannot load a collection as @font-face
        const ff = new FontFace(fam, f.rec.bytes.slice().buffer, { weight: String(f.weight), style: f.italic ? "italic" : "normal" });
        return ff.load().then(x => { document.fonts.add(x); return true }, () => false);
      })).then(r => r.some(Boolean));
    }
    full.set(key, p);
    return p;
  }

  // ---- files for the zip
  const safe = s => s.replace(/[^A-Za-z0-9._-]+/g, "_");
  const LICENSE_FILES = { "OFL-1.1": "licenses/OFL-1.1.txt", "Apache-2.0": "licenses/Apache-2.0.txt", "UFL-1.0": "licenses/UFL-1.0.txt" };
  async function pool(jobs, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (i < jobs.length) await fn(jobs[i++]) }));
  }
  // needs: Map family -> [{weight (0 = as the game asks: regular and bold), italic}] from the rules.
  // -> {files: [{name, data}] (name relative to the game's font folder), sources: [{family, kind, url}], warnings}
  async function collect(needs, progress = () => {}) {
    const files = [], sources = [], warnings = [], used = new Set(), seen = new Map(), licenses = new Map();
    const put = (name, data) => {
      let n = name, i = 2;
      while (used.has(lc(n))) n = name.replace(/(\.[^.]+)?$/, m => `-${i++}${m}`);
      used.add(lc(n)); files.push({ name: n, data });
      return n;
    };
    const jobs = [];
    for (const [family, wants] of needs) {
      const s = get(family);
      if (!s) { warnings.push(`${family}: font not available, not included`); continue }
      sources.push(s.kind === "file" && s.url ? { family: s.family, kind: "url", url: s.url } : { family: s.family, kind: s.kind });
      if (s.kind === "google") {
        const d = await detail(s), faces = new Set();
        const italicOk = s.styles.includes("italic"), normalOk = s.styles.includes("normal");
        for (const w of wants) {
          const style = (w.italic && italicOk) || !normalOk ? "italic" : "normal";
          for (const want of w.weight ? [w.weight] : [400, 700]) faces.add(`${nearest(want, s.weights)}|${style}`);
        }
        let subs = ZIP_SUBSETS.filter(x => (d.subsets || []).includes(x));
        if (!subs.length) subs = (d.subsets || []).filter(x => x !== "math" && x !== "symbols");
        for (const f of faces) {
          const [w, st] = f.split("|");
          for (const sub of subs) {
            const url = d.variants?.[w]?.[st]?.[sub]?.url?.ttf;
            if (url) jobs.push({ s, w: +w, italic: st === "italic", sub, url });
          }
        }
        if (s.license) licenses.set(s.family, s);
      } else if (s.kind === "file") {
        const recs = new Set(s.faces.map(f => f.rec));
        for (const r of recs) put("notosans-" + safe(r.file), r.bytes);
      } else {
        for (const f of s.faces) jobs.push({ s, fd: f.fd });
      }
    }
    let done = 0;
    progress(0, jobs.length);
    const copyright = new Map();
    await pool(jobs, 6, async j => {
      try {
        if (j.fd) {
          const b = new Uint8Array(await (await j.fd.blob()).arrayBuffer()), k = b.length + ":" + ZIP.crc32(b);
          if (!seen.has(k)) seen.set(k, put(`notosans-${safe(j.fd.postscriptName || j.fd.fullName)}.${SFNT.kind(b) === "ttc" ? "ttc" : "ttf"}`, b));
        } else {
          const r = await fetch(j.url);
          if (!r.ok) throw new Error(r.status);
          const raw = new Uint8Array(await r.arrayBuffer());
          if (!copyright.has(j.s.family)) copyright.set(j.s.family, SFNT.parse(raw)[0].copyright);
          // one family name for all files: Fontsource's files name some weights as families of their own
          put(`notosans-${j.s.id}-${j.w}${j.italic ? "i" : ""}-${j.sub}.ttf`, SFNT.rename(raw, j.s.family, j.w, j.italic));
        }
      } catch (e) {
        warnings.push(`${j.s.family}${j.sub ? ` ${j.w}${j.italic ? " italic" : ""} (${j.sub})` : ""}: download failed (${e.message})`);
      }
      progress(++done, jobs.length);
    });
    // license texts of the Google fonts
    const texts = new Map();
    for (const [family, s] of licenses) {
      const lf = LICENSE_FILES[s.license];
      if (lf && !texts.has(lf)) texts.set(lf, await fetch(lf).then(r => r.ok ? r.text() : "").catch(() => ""));
      const head = `${family}\n${copyright.get(family) || ""}\nLicense: ${s.license}${lf ? ` (${lf.split("/").pop()})` : ""}\nhttps://fonts.google.com/specimen/${family.replace(/ /g, "+")}\nFiles: from Fontsource (https://fontsource.org), names rewritten for CS2 Font Studio.\n`;
      files.push({ name: `notosans-licenses/${safe(family)}.txt`, data: head });
    }
    for (const [lf, text] of texts) if (text) files.push({ name: "notosans-licenses/" + lf.split("/").pop(), data: text });
    return { files, sources, warnings };
  }

  return {
    loadGoogle, restoreFiles, addFiles, addUrl, removeFamily, useLocal, useLocalIfGranted, hasLocalApi,
    get, names, hasItalic, category, tag, previewFamily, ensureFull, collect,
    onChange: f => listeners.add(f), get googleCount() { return googleCount },
  };
})();
