const zlib = require('zlib');

function chunk(tag, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(tag), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

function trayPng(size, color = [0, 0, 0]) {
  const rows = [];
  const center = (size - 1) / 2;
  const outer = size * 0.36;
  const inner = size * 0.22;
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const alpha = distance <= outer && distance >= inner ? 255 : 0;
      const offset = 1 + x * 4;
      row[offset] = color[0];
      row[offset + 1] = color[1];
      row[offset + 2] = color[2];
      row[offset + 3] = alpha;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function coverage(distance, radius, feather) {
  if (distance <= radius - feather) return 1;
  if (distance >= radius + feather) return 0;
  return clamp01(1 - (distance - (radius - feather)) / (2 * feather));
}

function mix(base, color, amount) {
  const t = clamp01(amount);
  return [
    base[0] + (color[0] - base[0]) * t,
    base[1] + (color[1] - base[1]) * t,
    base[2] + (color[2] - base[2]) * t,
  ];
}

function appIconPng(size) {
  const samples = size >= 256 ? 3 : 2;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const ring = size * 0.29;
  const half = size * 0.046;
  const glow = size * 0.016;
  const sweep = 0.72 * Math.PI * 2;
  const feather = 0.7;
  const bg = [9, 15, 22];
  const track = [52, 68, 84];
  const cyan = [94, 210, 255];
  const cap0x = cx;
  const cap0y = cy - ring;
  const cap1x = cx + ring * Math.sin(sweep);
  const cap1y = cy - ring * Math.cos(sweep);

  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let t = Math.atan2(dx, -dy);
          if (t < 0) t += Math.PI * 2;
          const onArc = t <= sweep;
          const dRing = Math.abs(dist - ring);
          const dCap = Math.min(
            Math.hypot(px - cap0x, py - cap0y),
            Math.hypot(px - cap1x, py - cap1y),
          );
          const dArc = onArc ? dRing : dCap;
          let pixel = mix(bg, track, coverage(dRing, half * 0.92, feather));
          pixel = mix(pixel, cyan, coverage(dArc, half + glow, glow) * 0.18);
          pixel = mix(pixel, cyan, coverage(dArc, half, feather));
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
        }
      }
      const count = samples * samples;
      const offset = 1 + x * 4;
      row[offset] = Math.round(r / count);
      row[offset + 1] = Math.round(g / count);
      row[offset + 2] = Math.round(b / count);
      row[offset + 3] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map((image) => {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

module.exports = { trayPng, appIconPng, icoFromPngs };
