// Headless Chrome screenshots with software WebGL (works even when the app's browser pane has WebGL blocked).
// Example: node tools/shot.mjs "http://localhost:3000/?motion=1" .shots/jump "[data-jump]" "0.1,0.3,0.5"
//          node tools/shot.mjs "http://localhost:3000/?motion=1" .shots/top - "0,600,1200"   (absolute px)
// Usage: node shot.mjs <url> <outPrefix> <selector|-> <p1,p2,...> [w] [h]
// Scrolls so that `selector` section progress = p (or absolute px if selector is "-"), screenshots each.
import puppeteer from 'puppeteer-core';
const [url, out, sel, list, w = '1200', h = '750'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--force-prefers-no-reduced-motion'],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 6000));
const gl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
console.log('webgl2', gl);
for (const v of list.split(',').map(Number)) {
  await page.evaluate((sel, v) => {
    if (sel === '-') return window.scrollTo(0, v);
    const s = document.querySelector(sel);
    const top = s.getBoundingClientRect().top + scrollY;
    window.scrollTo(0, top + (s.offsetHeight - innerHeight) * v);
  }, sel, v);
  await new Promise((r) => setTimeout(r, 2500));
  const f = `${out}-${String(v).replace('.', '_')}.png`;
  await page.screenshot({ path: f });
  console.log('saved', f);
}
await browser.close();
