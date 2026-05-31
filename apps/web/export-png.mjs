/**
 * 從 dist/cards.html 用 headless Chrome 真實 render，截下幾張代表性 PNG。
 * 開發測試用：讓我們不用本機開瀏覽器，就能驗證卡片產生器產出長什麼樣。
 *
 * 用法：node export-png.mjs
 *   產出 dist/sample-*.png
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsUrl = 'file://' + resolve(__dirname, 'dist/cards.html');

// 要產出的代表性樣本：分類 + 比例 + (可選) 信心度
const samples = [
  { cat: 'it', ratio: '1x1', conf: 0.7, n: 10, theme: 't-punch', label: 'IT 1:1 爆款' },
  { cat: 'food', ratio: '1x1', conf: 0.7, n: 10, theme: 't-light', label: '飲食 1:1 白底' },
  { cat: 'internet-slang', ratio: '1x1', conf: 0.7, n: 10, theme: 't-mute', label: '網路流行語 1:1 低調' },
  { cat: 'daily-life', ratio: '4x5', conf: 0.7, n: 12, theme: 't-punch', label: '日常 4:5 爆款' },
  { cat: 'politics', ratio: '9x16', conf: 0.95, n: 8, theme: 't-punch', label: '政治 9:16 Stories' },
];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});

for (const s of samples) {
  const page = await browser.newPage();
  // viewport 大一點避免被 viewport-relative CSS 卡住
  await page.setViewport({ width: 2000, height: 2400, deviceScaleFactor: 1 });
  await page.goto(cardsUrl, { waitUntil: 'networkidle0' });

  // 透過 evaluate 直接設定 state + render
  await page.evaluate((s) => {
    document.getElementById('cat').value = s.cat;
    document.getElementById('cat').dispatchEvent(new Event('change'));
    document.getElementById('conf').value = String(s.conf);
    document.getElementById('conf').dispatchEvent(new Event('input'));
    document.getElementById('n').value = String(s.n);
    document.getElementById('n').dispatchEvent(new Event('input'));
    document.querySelector(`.ratio-btns:not(#theme-btns) button[data-ratio="${s.ratio}"]`).click();
    document.querySelector(`#theme-btns button[data-theme="${s.theme}"]`).click();

    // 把 #card 提到 viewport 左上角獨立顯示，避免被 panel/wrap 的 transform、
    // overflow:auto、grid 限制截圖。這樣 element.screenshot 拿到的就是純卡片。
    const card = document.getElementById('card');
    card.style.position = 'fixed';
    card.style.top = '0';
    card.style.left = '0';
    card.style.transform = 'none';
    card.style.zIndex = '99999';
    document.body.style.margin = '0';
    document.body.style.background = '#fff';
  }, s);

  // 等 QR canvas + layout 都穩定（QRCode.toCanvas 是 async callback）
  await new Promise((r) => setTimeout(r, 800));

  const cardEl = await page.$('#card');
  const path = resolve(__dirname, `dist/sample-${s.cat}-${s.ratio}-${s.theme}.png`);
  await cardEl.screenshot({ path, omitBackground: false });
  console.log(`✓ ${s.label} → ${path}`);
  await page.close();
}

await browser.close();
console.log('done');
