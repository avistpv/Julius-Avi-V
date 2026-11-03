// Pre-renders the glass bust for the 2D hero: 9 yaw frames from /lab/bust (dev server on :3000,
// headless Chrome on the real GPU) -> public/bust/f0..f8.webp. Run: node tools/bust-frames.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const { default: puppeteer } = await import(pathToFileURL(path.join(root, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
const sharp = (await import('sharp')).default;

const BASE = process.argv[2] ?? 'http://localhost:3000';
const YAWS = Array.from({ length: 9 }, (_, i) => -0.6 + (1.2 * i) / 8);
const out = path.join(root, 'public/bust');
fs.mkdirSync(out, { recursive: true });

const chrome = process.env.CHROME ?? (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/lab/bust`, { waitUntil: 'networkidle2', timeout: 180000 });
const gl = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const i = g?.getExtension('WEBGL_debug_renderer_info'); return i ? g.getParameter(i.UNMASKED_RENDERER_WEBGL) : 'none'; });
console.log('renderer:', gl);
await page.waitForFunction(() => !!window.__bust, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < YAWS.length; i++) {
  const url = await page.evaluate((y) => window.__bust.render(y), YAWS[i]);
  const png = Buffer.from(url.split(',')[1], 'base64');
  const file = path.join(out, `f${i}.webp`);
  await sharp(png).webp({ quality: 84 }).toFile(file);
  console.log(path.basename(file), Math.round(fs.statSync(file).size / 1024) + 'KB', 'yaw', YAWS[i].toFixed(2));
}
await browser.close();
