'use strict';

// Paints the six station interiors of /board.html with scripts/board-artwork.js
// in headless Chromium, encodes them as WebP there, writes content-hashed files
// to public/assets/board, and points board.js at them. Run with Playwright in
// HOUSE_TEST_TOOLS or UR_BUILD_TOOLS (a node_modules directory), or local.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public/assets/board');
const preview = process.argv.includes('--preview');

(async () => {
  const browser = await chromium.launch({ headless: true });
  let images;
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: path.join(__dirname, 'board-artwork.js') });
    images = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      return Object.fromEntries(boardArtwork.scenes.map(name => [name, boardArtwork.drawStation(name, canvas).toDataURL('image/webp', .72)]));
    });
  } finally {
    await browser.close();
  }
  fs.mkdirSync(output, { recursive: true });
  const manifest = {};
  for (const [name, data] of Object.entries(images)) {
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const filename = preview ? `${name}.webp` : `${name}-${hash}.webp`;
    fs.writeFileSync(path.join(output, filename), bytes);
    manifest[name] = `/assets/board/${filename}`;
    console.log(`${filename}: ${bytes.length} bytes`);
  }
  if (preview) return;
  fs.writeFileSync(path.join(__dirname, 'board-artwork-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const boardFile = path.join(root, 'public/board.js');
  let source = fs.readFileSync(boardFile, 'utf8');
  for (const [name, url] of Object.entries(manifest)) {
    source = source.replace(new RegExp(`/assets/board/${name}-(?:[a-f0-9]+|pending)\\.webp`, 'g'), url);
  }
  fs.writeFileSync(boardFile, source);
})().catch(error => { console.error(error); process.exitCode = 1; });
