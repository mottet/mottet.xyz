'use strict';

// Runs the Flux visualisation benchmark (flux/bench/) in Chromium for each
// candidate and scenario, on a desktop profile and a throttled phone
// profile, and prints a markdown table plus scripts/flux-bench-report.json.
// Needs HOUSE_TEST_TOOLS (Playwright) and the vendor libraries from
// scripts/bench-flux-setup.sh.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const TOOLS = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
if (!TOOLS) { console.error('set HOUSE_TEST_TOOLS to a node_modules holding playwright'); process.exit(1); }
const { chromium } = require(path.join(TOOLS, 'playwright'));
const PORT = 8099;
const ROOT = path.join(__dirname, '..');
const candidates = (process.env.BENCH_CANDIDATES || 'custom,d3,echarts').split(',');
const scenarios = (process.env.BENCH_SCENARIOS || 'L0,L1,L2,L3').split(',');

async function main() {
  const server = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), FLUX_BENCH: '1' }, stdio: ['ignore', 'ignore', 'inherit'] });
  process.on('exit', () => server.kill());
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const profile of ['desktop', 'phone']) {
      const ctx = await browser.newContext(profile === 'desktop' ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      for (const candidate of candidates) for (const scenario of scenarios) {
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile === 'phone' ? 4 : 1 });
        await page.goto(`http://flux.localhost:${PORT}/bench/?candidate=${candidate}&scenario=${scenario}&runs=10`);
        await page.waitForFunction(() => window.__bench, null, { timeout: 120000 });
        const r = await page.evaluate(() => window.__bench);
        results.push({ profile, ...r });
        console.error(`${profile} ${candidate} ${scenario}: layout p50 ${r.layoutMs?.p50} ms, paint p50 ${r.paintMs?.p50} ms, frame p95 ${r.frameMs?.p95} ms, long ${r.longFrames}, hover p95 ${r.hoverMs?.p95} ms${r.error ? ' ERROR ' + r.error : ''}`);
        await page.close();
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.kill(); }
  fs.writeFileSync(path.join(__dirname, 'flux-bench-report.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), results }, null, 1));
  console.log('| profil | candidat | scénario | nœuds | rubans | layout p50 (ms) | peinture p50 (ms) | image p95 (ms) | images > 16,7 ms | survol p95 (ms) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) console.log(`| ${r.profile} | ${r.candidate} | ${r.scenario} | ${r.nodes} | ${r.ribbons} | ${r.layoutMs?.p50 ?? '—'} | ${r.paintMs?.p50 ?? '—'} | ${r.frameMs?.p95 ?? '—'} | ${r.longFrames ?? '—'} | ${r.hoverMs?.p95 ?? '—'} |`);
}
main().catch(e => { console.error(e); process.exit(1); });
