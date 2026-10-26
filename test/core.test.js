"use strict";
// node --test: the conf, font and zip modules (run from the repo root)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CONF = require("../conf.js");
const SFNT = require("../sfnt.js");
const ZIP = require("../zip.js");

const fixture = f => new Uint8Array(fs.readFileSync(path.join(__dirname, "..", f)));
const stateLine = /\t<!-- state: .* -->\n/;

test("conf matches the exe (app/apply.go buildConf)", () => {
  // test/conf.golden.json: written by buildConf in Go for these states. The state comment is compared as JSON (Go escapes
  // <, > and & in it), the rules byte for byte.
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "conf.golden.json"), "utf8"));
  const italicFaces = new Set(["Arial"]); // what the Go side found installed: Impact has no italic face
  for (const { state, conf } of golden) {
    const st = { rules: state.rules || [], copied: state.copied, textScale: state.textScale || 0 };
    const got = CONF.build(st, f => italicFaces.has(f));
    assert.equal(got.replace(stateLine, ""), conf.replace(stateLine, ""));
    assert.deepEqual(CONF.readState(got).rules, CONF.readState(conf).rules);
  }
});

test("state round trip, with -- in a name", () => {
  const st = { rules: [{ group: "Stratum2", font: "A--B", scale: 1 }], copied: ["x.ttf"], textScale: 1.5, fonts: [{ family: "A--B", kind: "url", url: "https://e.x/a--b.ttf" }] };
  const conf = CONF.build(st);
  const comment = conf.match(/<!-- state: ([\s\S]*?) -->/)[1];
  assert.ok(!comment.includes("--"), "the comment must not contain --");
  const back = CONF.readState(conf);
  assert.equal(back.rules[0].font, "A--B");
  assert.equal(back.textScale, 1.5);
  assert.equal(back.fonts[0].url, "https://e.x/a--b.ttf");
  assert.equal(CONF.readState("<fontconfig/>"), null);
});

test("normalizeTextScale", () => {
  for (const bad of [0.1, 0.49, 2.01, 10, -1, NaN, Infinity]) assert.throws(() => CONF.normalizeTextScale(bad));
  for (const [i, w] of [[0, 0], [1, 0], [0.5, 0.5], [1.25, 1.25], [2, 2]]) assert.equal(CONF.normalizeTextScale(i), w);
});

test("font names and rename", () => {
  const src = fixture("fonts/ChivoMono-Light.ttf");
  assert.equal(SFNT.kind(src), "sfnt");
  const [f] = SFNT.parse(src);
  assert.match(f.family, /Chivo Mono/);
  assert.equal(f.weight, 300);
  const out = SFNT.rename(src, "My Family", 600, true);
  const [g] = SFNT.parse(out);
  assert.equal(g.family, "My Family");
  assert.equal(g.legacyFamily, "My Family");
  assert.equal(g.style, "SemiBold Italic");
  assert.equal(g.weight, 600);
  assert.equal(g.italic, true);
  assert.equal(g.copyright, f.copyright, "copyright is kept");
  // whole-file checksum is 0xB1B0AFBA
  const v = new DataView(out.buffer);
  let s = 0;
  for (let i = 0; i < out.length; i += 4) s = (s + v.getUint32(i)) >>> 0;
  assert.equal(s, 0xB1B0AFBA);
  assert.throws(() => SFNT.parse(new TextEncoder().encode("wOF2 not really a font")), /WOFF/);
  assert.throws(() => SFNT.parse(new Uint8Array(40)), /not a font/);
});

test("zip round trip", async () => {
  const font = fixture("fonts/ChivoMono-Regular.ttf");
  const blob = await ZIP.build([{ name: "game/csgo/panorama/fonts/notosans-a.ttf", data: font }, { name: "game/core/x/ü.conf", data: "hello" }]);
  const entries = ZIP.read(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(entries.map(e => e.name), ["game/csgo/panorama/fonts/notosans-a.ttf", "game/core/x/ü.conf"]);
  assert.deepEqual(await entries[0].read(), font);
  assert.equal(new TextDecoder().decode(await entries[1].read()), "hello");
  assert.ok(blob.size < font.length, "fonts are deflated");
  assert.throws(() => ZIP.read(new Uint8Array(100)), /not a zip/);
});
