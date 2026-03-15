const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size;

  ctx.fillStyle = '#cc0000';
  ctx.fillRect(0, 0, s, s);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(s * 0.45)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YT', s / 2, s * 0.38);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(s * 0.1, s * 0.58, s * 0.8, s * 0.03);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.round(s * 0.19)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LINKS', s / 2, s * 0.73);

  return c.toBuffer('image/png');
}

for (const size of [16, 48, 128]) {
  const buf = drawIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`Created icon${size}.png`);
}
