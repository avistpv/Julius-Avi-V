// E2E smoke test of the landing page: headless system Chrome with software WebGL.
// Usage: node tools/e2e.mjs [baseUrl]        (default http://localhost:3000)
//        CHROME=/path/to/chrome node tools/e2e.mjs   (override the browser binary)
// Exit code 1 if any check fails.
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const CHROME = process.env.CHROME ?? (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--force-prefers-no-reduced-motion'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const errors = [];
const requested = [];
page.on('request', (r) => requested.push(r.url()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });

// Click only once the element is what the pointer would actually hit and has stopped moving (not
// covered by the fading preloader, not mid reveal-slide) — the actionability wait Playwright does.
const clickWhenHittable = async (sel) => {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const pos = `${r.x},${r.y}`;
    const isStill = el.dataset.e2ePos === pos;
    el.dataset.e2ePos = pos;
    return isStill && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }, { timeout: 8000, polling: 100 }, sel);
  await page.click(sel);
};

// Scroll so that section `sel` is at progress p (0 = its top at the viewport top, 1 = its end).
const scrollSection = (sel, p) => page.evaluate((sel, p) => {
  const s = document.querySelector(sel);
  const top = s.getBoundingClientRect().top + scrollY;
  window.scrollTo(0, top + (s.offsetHeight - innerHeight) * p);
}, sel, p);

await check('home responds 200', async () => {
  const res = await page.goto(`${BASE}/?motion=1`, { waitUntil: 'networkidle2', timeout: 60000 });
  assert(res.status() === 200, `status ${res.status()}`);
});

await check('preloader clears within 5s', () =>
  page.waitForFunction(() => document.querySelector('section[aria-label="Intro"]')?.className.includes('isReady'), { timeout: 5000 }));

await check('paintings not fetched on first load', async () => {
  const early = requested.filter((u) => u.includes('/jump/'));
  assert(early.length === 0, `fetched early: ${early.join(', ')}`);
});

await check('h1 slogan', async () => {
  const label = await page.$eval('h1', (h) => h.getAttribute('aria-label'));
  assert(label === 'We build products that ship.', `h1 = ${label}`);
});

await check('WebGL canvas mounted', async () => {
  const n = await page.$$eval('canvas', (c) => c.length);
  assert(n > 0, 'no <canvas>');
});

await check('clock toggles Roman numerals', async () => {
  const before = await page.$eval('button[title="Roman numerals"]', (b) => b.textContent);
  await clickWhenHittable('button[title="Roman numerals"]');
  const after = await page.$eval('button[title="Arabic numerals"]', (b) => b.textContent);
  assert(before !== after, 'text unchanged');
});

await check('nav anchors point to existing sections', async () => {
  const missing = await page.$$eval('nav a[href^="#"]', (as) =>
    as.map((a) => a.getAttribute('href')).filter((h) => !document.querySelector(h)));
  assert(missing.length === 0, `no target for ${missing.join(', ')}`);
});

await check('nav [Contact] lands on the open form', async () => {
  await clickWhenHittable('nav a[href="#contact"]');
  await wait(3000); // the sections mount first, then the page scrolls and re-aims once
  const p = await page.evaluate(() => {
    const f = document.querySelector('[data-finale]');
    return (scrollY - f.offsetTop) / (f.offsetHeight - innerHeight);
  });
  assert(p > 0.9, `finale progress ${p.toFixed(2)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);
});

await check('all sections render', async () => {
  // Sections below the fold mount on approach: walk the page once so they exist.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(600);
  const empty = await page.evaluate(() =>
    ['[data-bust-anchor]', '#work', '[data-jump]', '[data-legio]', '[data-finale]']
      .filter((s) => !(document.querySelector(s)?.offsetHeight > 0)));
  assert(empty.length === 0, `missing/empty: ${empty.join(', ')}`);
});

await check('full scroll-through without errors', async () => {
  const before = errors.length;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await wait(250);
  }
  assert(errors.length === before, `${errors.length - before} new error(s) while scrolling`);
});

await check('work + team images loaded', async () => {
  // The local optimiser encodes on first request: give the lazily mounted team up to 10 s.
  let broken = [];
  for (let i = 0; i < 20; i++) {
    broken = await page.$$eval('#work img, [data-legio] img', (imgs) =>
      imgs.filter((img) => !(img.complete && img.naturalWidth > 0)).map((img) => img.currentSrc || img.src));
    if (broken.length === 0) break;
    await wait(500);
  }
  assert(broken.length === 0, `broken: ${broken.slice(0, 3).join(', ')}`);
});

await check('paintings fetched once the section is near', async () => {
  const got = ['/jump/arch.webp', '/jump/landscape.webp'].filter((f) => requested.some((u) => u.includes(f)));
  assert(got.length === 2, `fetched: ${got.join(', ') || 'none'}`);
});

await check('numbers count up to 140+', async () => {
  await scrollSection('[data-finale]', 0.1);
  await page.waitForFunction(() => document.querySelector('[data-finale] h2 ~ div span')?.textContent === '140+', { timeout: 5000 });
});

await scrollSection('[data-finale]', 1);
await wait(2500);
const submit = '[data-finale] button[type="submit"]';

await check('form blocks empty submit', async () => {
  await page.click(submit);
  const state = await page.$eval(submit, (b) => ({ text: b.textContent, valid: b.form.checkValidity() }));
  assert(!state.valid && state.text.includes('Book a call'), `sent without data: ${state.text}`);
});

await check('form submit shows sent state', async () => {
  await page.type('input[name="name"]', 'Gaius Julius');
  await page.type('input[name="contact"]', 'gaius@rome.example');
  await page.click(submit);
  const state = await page.$eval(submit, (b) => ({ text: b.textContent, disabled: b.disabled }));
  assert(state.disabled && state.text.includes('call you'), `button: ${state.text}`);
});

await check('/lab responds 200', async () => {
  const res = await page.goto(`${BASE}/lab`, { waitUntil: 'domcontentloaded' });
  assert(res.status() === 200, `status ${res.status()}`);
});

await check('unknown route returns 404', async () => {
  const res = await page.goto(`${BASE}/no-such-page`, { waitUntil: 'domcontentloaded' });
  assert(res.status() === 404, `status ${res.status()}`);
});
// The 404 above is expected (it also logs a generic "Failed to load resource" line); drop both.
const unexpected = errors.filter((e) => !e.includes('/no-such-page') && !e.includes('status of 404'));
await check('no unexpected console / network errors', async () => {
  assert(unexpected.length === 0, `${unexpected.length} error(s), listed below`);
});

await browser.close();
for (const [s, name, why] of results) console.log(`${s}  ${name}${why ? ` — ${why}` : ''}`);
if (unexpected.length) console.log(`\nErrors seen (${unexpected.length}):\n  ${[...new Set(unexpected)].join('\n  ')}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
