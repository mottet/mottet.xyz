'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.UR_BUILD_TOOLS ? path.join(process.env.UR_BUILD_TOOLS, 'playwright') : 'playwright');
const url = process.env.UR_BASE_URL || 'https://mottet.xyz/urBoard.html';
const runs = Number(process.env.UR_PERF_RUNS || 40);
const latency = Number(process.env.UR_PERF_LATENCY || 40);
const downloadMbps = Number(process.env.UR_PERF_MBPS || 4);
const profiles = [
 { name: 'desktop-cold', width: 1440, height: 900, scale: 1, cpu: 1 },
 { name: 'mobile-cold', width: 390, height: 844, scale: 2, cpu: 4 }
];
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

(async () => {
 const browser = await chromium.launch({ headless: true });
 const report = { date: new Date().toISOString(), url, metric: 'Navigation to first painted, connected table with board, garden, and counters', network: { latencyMs: latency, downloadMbps, uploadMbps: 1 }, profiles: [] };
 try {
  for (const profile of profiles) {
   const samples = [];
   for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.scale });
    try {
     const page = await context.newPage();
     const errors = [];
     page.on('pageerror', error => errors.push(error.message));
     const cdp = await context.newCDPSession(page);
     await cdp.send('Network.enable');
     await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
     await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
     await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: downloadMbps * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8 });
     await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
     await page.waitForFunction(() => performance.getEntriesByName('ur-ready').length > 0, null, { timeout: 10000 });
     assert.deepEqual(errors, []);
     assert.equal(await page.locator('#garden-background').getAttribute('data-layers'), '3');
     const sample = await page.evaluate(() => ({ readyMs: Math.round(performance.getEntriesByName('ur-ready')[0].startTime), dclMs: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd), transferredBytes: performance.getEntriesByType('resource').reduce((sum, resource) => sum + resource.transferSize, performance.getEntriesByType('navigation')[0].transferSize), transport: socket.io.engine.transport.name }));
     samples.push(sample);
    } catch (error) {
     samples.push({ readyMs: 10000, error: error.message });
    } finally {
     await context.close();
    }
    if ((run + 1) % 10 === 0) console.log(`${profile.name}: ${run + 1}/${runs} samples`);
   }
   const times = samples.map(sample => sample.readyMs);
   const summary = { ...profile, runs, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.max(...times), underOneSecondPercent: times.filter(time => time < 1000).length / runs * 100, samples };
   report.profiles.push(summary);
   console.log(JSON.stringify({ profile: profile.name, runs, p50Ms: summary.p50Ms, p95Ms: summary.p95Ms, maxMs: summary.maxMs, underOneSecondPercent: summary.underOneSecondPercent }));
  }
 } finally {
  await browser.close();
 }
 fs.writeFileSync(path.join(__dirname, 'ur-performance-report.json'), JSON.stringify(report, null, 2) + '\n');
 for (const profile of report.profiles) {
  assert.ok(profile.p95Ms < 1000 && profile.underOneSecondPercent >= 95, `${profile.name} missed the target: p95 ${profile.p95Ms}ms`);
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
