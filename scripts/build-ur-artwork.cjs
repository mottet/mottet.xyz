'use strict';

// Run with Playwright and Sharp installed in UR_BUILD_TOOLS (a node_modules
// directory), or available locally. Only material textures are pre-rendered.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const requireTool = name => require(process.env.UR_BUILD_TOOLS ? path.join(process.env.UR_BUILD_TOOLS, name) : name);
const { chromium } = requireTool('playwright');
const sharp = requireTool('sharp');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public/assets/ur');

(async () => {
 const browser = await chromium.launch({ headless: true });
 let images;
 try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: path.join(__dirname, 'ur-artwork.js') });
  await page.addScriptTag({ path: path.join(root, 'public/urGarden.js') });
  images = await page.evaluate(() => {
   const scene = buildScene();
   const images = { board: scene.toDataURL() };
   images.walnut = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512"><defs>${UrGarden.materialDefinitions('material')}</defs><rect width="256" height="512" fill="url(#material-wood)"/></svg>`;
   for (const [name, color] of [['shell', 'blue'], ['lapis', 'red']]) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 192;
    const context = sprite.getContext('2d');
    context.scale(2, 2);
    drawCounterArtwork(context, color);
    images[name] = sprite.toDataURL();
   }
   return images;
  });
 } finally {
  await browser.close();
 }
 fs.mkdirSync(output, { recursive: true });
 const manifest = {};
 for (const [name, data] of Object.entries(images)) {
  const material = name === 'walnut';
  const source = material ? Buffer.from(data) : Buffer.from(data.split(',')[1], 'base64');
  const counter = name === 'shell' || name === 'lapis';
  const size = material ? 512 : counter ? 192 : 800;
  manifest[name] = {};
  for (const format of counter ? ['png'] : ['webp']) {
   const pipeline = sharp(source).resize(size, material ? 1024 : size);
   const bytes = await (counter ? pipeline.png({ palette: true, colours: 128, dither: .6 }) : pipeline.webp({ quality: material ? 55 : 35, alphaQuality: 80, effort: 5 })).toBuffer();
   const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
   const filename = `${name}-${hash}.${format}`;
   fs.writeFileSync(path.join(output, filename), bytes);
   manifest[name][format] = `/assets/ur/${filename}`;
   console.log(`${filename}: ${bytes.length} bytes`);
  }
 }
 fs.writeFileSync(path.join(__dirname, 'ur-artwork-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
 // Update existing HTML references when rebuilding the artwork.
 const htmlFile = path.join(root, 'public/urBoard.html');
 let html = fs.readFileSync(htmlFile, 'utf8');
 for (const [name, formats] of Object.entries(manifest)) {
  for (const [format, url] of Object.entries(formats)) {
   html = html.replace(new RegExp(`/assets/ur/${name}-(?:[a-f0-9]+|pending)\\.${format}`, 'g'), url);
  }
 }
 fs.writeFileSync(htmlFile, html);
 const gardenFile = path.join(root, 'public/urGarden.js');
 fs.writeFileSync(gardenFile, fs.readFileSync(gardenFile, 'utf8').replace(/\/assets\/ur\/walnut-(?:[a-f0-9]+|pending)\.webp/g, manifest.walnut.webp));
})().catch(error => { console.error(error); process.exitCode = 1; });
