"use strict";
// A small zip writer and reader: deflate through the browser's CompressionStream ("deflate-raw"), stored where that is
// missing or does not help. Enough for the fonts and the conf of a CS2 Font Studio zip, and for zips of fonts from the web.

const ZIP = (() => {
  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0 }
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const canDeflate = typeof CompressionStream !== "undefined";
  const pipe = async (b, stream) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(stream)).arrayBuffer());
  const deflate = b => pipe(b, new CompressionStream("deflate-raw"));
  const inflate = b => pipe(b, new DecompressionStream("deflate-raw"));
  const enc = new TextEncoder();
  const toBytes = d => typeof d === "string" ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d);

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // entries: [{name, data: Uint8Array|ArrayBuffer|string}] -> Blob (application/zip). Names use "/" and are UTF-8.
  async function build(entries, now = new Date()) {
    const { time, date } = dosTime(now), parts = [], central = [];
    let offset = 0;
    for (const e of entries) {
      const raw = toBytes(e.data), name = enc.encode(e.name), crc = crc32(raw);
      let method = 0, body = raw;
      if (canDeflate && raw.length > 64) {
        const z = await deflate(raw);
        if (z.length < raw.length) { method = 8; body = z }
      }
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, body.length, true); h.setUint32(22, raw.length, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, body);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, method, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, body.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, name.length, true);
      c.setUint32(38, e.name.endsWith("/") ? 0x10 : 0x20, true); c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }

  // bytes of a zip -> [{name, size, read(): Promise<Uint8Array>}]; throws if it is not a zip
  function read(bytes, maxFiles = 1024) {
    const b = toBytes(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break }
    if (e < 0) throw new Error("not a zip archive");
    const n = v.getUint16(e + 10, true), dec = new TextDecoder();
    if (n > maxFiles) throw new Error("the archive holds too many files");
    let p = v.getUint32(e + 16, true);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw new Error("broken zip archive");
      const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
      const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl)).replace(/\\/g, "/");
      p += 46 + nl + xl + cl;
      if (name.endsWith("/")) continue;
      out.push({
        name, size,
        async read() {
          if (flags & 1) throw new Error(`${name} is encrypted`);
          if (lho + 30 > b.length || v.getUint32(lho, true) !== 0x04034b50) throw new Error("broken zip archive");
          const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true), body = b.subarray(start, start + csize);
          if (method === 0) return body.slice();
          if (method === 8) return inflate(body);
          throw new Error(`${name}: unsupported compression`);
        },
      });
    }
    return out;
  }

  return { build, read, crc32 };
})();

if (typeof module !== "undefined") module.exports = ZIP;
