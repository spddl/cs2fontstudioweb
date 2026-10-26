"use strict";
// 99-spddl.conf: the fontconfig rules the game reads from game\core\panorama\fonts\conf.d. Same output as buildConf in
// CS2 Font Studio (app/apply.go), so a zip from the web page and the exe write the same file.

const CONF = (() => {
  const minTextScale = 0.5, maxTextScale = 2.0;

  // trivial reports whether the rule changes nothing
  const trivial = r => !r.font && (!(r.scale > 0) || r.scale === 1) && !r.weight && !r.italic && (!(r.width > 0) || r.width === 1);

  // CSS weights to fontconfig weights
  function fcWeight(css) {
    if (css <= 100) return 0;
    if (css <= 200) return 40;
    if (css <= 300) return 50;
    if (css <= 400) return 80;
    if (css <= 500) return 100;
    if (css <= 600) return 180;
    if (css <= 700) return 200;
    if (css <= 800) return 205;
    return 210;
  }

  // 0 for "unchanged", throws for values outside the supported range
  function normalizeTextScale(x) {
    x = x == null || x === "" ? 0 : Number(x);
    if (x === 0 || x === 1) return 0;
    if (!Number.isFinite(x) || x < minTextScale || x > maxTextScale)
      throw new Error(`the text size must be between ${minTextScale * 100}% and ${maxTextScale * 100}%`);
    return x;
  }

  // like Go's encoding/xml EscapeText
  const esc = s => String(s).replace(/[&<>"'\t\n\r]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "'": "&#39;", "\t": "&#x9;", "\n": "&#xA;", "\r": "&#xD;" }[c]));
  // Go's %g for the values used here (0.05 steps, 0.2 shear)
  const g = x => String(x);

  // the rule as Go's json.Marshal writes it (field order, omitempty)
  function ruleJSON(r) {
    const o = { group: r.group, font: r.font || "", scale: r.scale || 0 };
    if (r.weight) o.weight = r.weight;
    if (r.italic) o.italic = true;
    if (r.width) o.width = r.width;
    return o;
  }

  // state: {rules, copied, textScale, fonts}. fonts (where the web page got each font) is only read by the web page.
  // hasItalicFace(font) tells whether the chosen font has a real italic face (otherwise the glyphs are sheared).
  function build(st, hasItalicFace = () => false) {
    const js = { rules: st.rules.map(ruleJSON), copied: st.copied && st.copied.length ? st.copied : null };
    if (st.textScale) js.textScale = st.textScale;
    if (st.fonts && st.fonts.length) js.fonts = st.fonts;
    // "--" ends an XML comment: escape the second dash (still the same JSON)
    const state = JSON.stringify(js).replace(/--/g, "-\\u002d");
    let b = "<?xml version='1.0'?>\n<!DOCTYPE fontconfig SYSTEM 'fonts.dtd'>\n<fontconfig>\n";
    b += "\t<!-- CS2 Font Studio. Delete this file to remove all changes. -->\n";
    b += `\t<!-- state: ${state} -->\n`;
    if (st.textScale > 0 && st.textScale !== 1) {
      // every font, fallbacks included: the font's pixel size is multiplied after the game's own rules
      b += `\t<match target="font"><edit name="pixelsize" mode="assign"><times><name>pixelsize</name><double>${g(st.textScale)}</double></times></edit></match>\n`;
    }
    for (const r of st.rules) {
      const gr = esc(r.group), f = esc(r.font || "");
      if (r.font) {
        b += `\t<match target="font"><test name="family"><string>${gr}</string></test><edit name="family" mode="assign"><string>${f}</string></edit></match>\n`;
        b += `\t<match target="pattern"><test name="family"><string>${gr}</string></test><edit name="family" mode="prepend" binding="strong"><string>${f}</string></edit></match>\n`;
      }
      if (r.scale > 0 && r.scale !== 1) {
        b += `\t<match target="font"><test name="family" target="pattern"><string>${gr}</string></test><edit name="pixelsize" mode="assign"><times><name>pixelsize</name><double>${g(r.scale)}</double></times></edit></match>\n`;
      }
      if (r.weight || r.italic) { // face selection: edit the request
        b += `\t<match target="pattern"><test name="family"><string>${gr}</string></test>`;
        if (r.weight) b += `<edit name="weight" mode="assign" binding="strong"><int>${fcWeight(r.weight)}</int></edit>`;
        if (r.italic) b += `<edit name="slant" mode="assign" binding="strong"><const>italic</const></edit>`;
        b += "</match>\n";
      }
      const width = r.width > 0 ? r.width : 1;
      const shear = r.italic && (!r.font || !hasItalicFace(r.font)) ? 0.2 : 0; // no real italic face: slant the glyphs
      if (width !== 1 || shear !== 0) { // glyph transformation (the game hands the matrix to FT_Set_Transform): edit the font
        b += `\t<match target="font"><test name="family" target="pattern"><string>${gr}</string></test>`;
        b += `<edit name="matrix" mode="assign"><times><name>matrix</name><matrix><double>${g(width)}</double><double>${g(shear)}</double><double>0</double><double>1</double></matrix></times></edit>`;
        b += "</match>\n";
      }
    }
    b += "</fontconfig>\n";
    return b;
  }

  // Earlier versions wrote "csfc-state"
  const stateRe = /<!-- (?:csfc-)?state: ([\s\S]*?) -->/;
  // the state of a 99-spddl.conf written by CS2 Font Studio (exe or web), null for any other file
  function readState(text) {
    const m = stateRe.exec(text);
    if (!m) return null;
    try {
      const st = JSON.parse(m[1]);
      return { rules: Array.isArray(st.rules) ? st.rules : [], copied: st.copied || [], textScale: +st.textScale || 0, fonts: Array.isArray(st.fonts) ? st.fonts : [] };
    } catch { return null }
  }

  return { trivial, fcWeight, normalizeTextScale, esc, build, readState };
})();

if (typeof module !== "undefined") module.exports = CONF;
