/**
 * TaiWords 靜態圖鑑產生器。
 *
 * 讀 repo 根的 data/seed/{categories,terms}.yaml（單一真實來源，與 API 共用），
 * 產出自包含的 dist/index.html：兩岸用語對照卡片，按分類分區，
 * 每張卡帶信心度色條與爭議標籤。
 *
 * 設計理念：採用社群瘋傳的「✅台灣詞 ❌中國詞」卡片格式（易截圖分享），
 * 但比一張病毒貼文多了 rigor——信心度分級 + 爭議詞明確標示，
 * 不假裝每條都是鐵板釘釘的支語。
 *
 * 用法：node generate.mjs  → 開 dist/index.html
 * Phase 3 會升級為 Next.js（per-term 路由 + OG image + SEO）。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../../data/seed');

const categories = yaml.load(readFileSync(`${SEED}/categories.yaml`, 'utf8')).categories;
const terms = yaml.load(readFileSync(`${SEED}/terms.yaml`, 'utf8')).terms;

const catName = new Map(categories.map((c) => [c.slug, c.nameZhTw ?? c.name_zh_tw]));
// 顯示順序：與 categories.yaml 一致
const catOrder = categories.map((c) => c.slug);

/** 把每個詞歸到它的「主分類」（categories[] 第一個），供分區顯示。 */
function primaryCat(t) {
  const cats = t.categories ?? [];
  return cats.find((c) => catName.has(c)) ?? cats[0] ?? 'other';
}

const grouped = new Map();
for (const t of terms) {
  const c = primaryCat(t);
  if (!grouped.has(c)) grouped.set(c, []);
  grouped.get(c).push(t);
}
// 各分區內：信心度高到低，其次台灣詞筆畫（用 localeCompare 近似）
for (const list of grouped.values()) {
  list.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a.canonical_zh_tw.localeCompare(b.canonical_zh_tw, 'zh-Hant'));
}

/** 信心度分三帶。<0.5 視為爭議/參考。 */
function band(conf) {
  if (conf >= 0.85) return 'high';
  if (conf >= 0.5) return 'mid';
  return 'low';
}
const bandLabel = { high: '公認', mid: '偏中', low: '爭議' };

const typeLabel = {
  same_meaning_diff_name: '同義異名',
  same_name_diff_meaning: '同名異實',
  cn_only: '中國特有',
  tw_only: '台灣特有',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const total = terms.length;
const disputed = terms.filter((t) => (t.confidence ?? 0) < 0.5).length;

function card(t) {
  const conf = t.confidence ?? 0;
  const b = band(conf);
  const pct = Math.round(conf * 100);
  const tw = esc(t.canonical_zh_tw);
  const cn = esc(t.canonical_zh_cn);
  const note = t.notes ? `<p class="note">${esc(t.notes.trim())}</p>` : '';
  const ctx = t.context_required ? '<span class="tag ctx">需看上下文</span>' : '';
  return `
    <article class="card ${b}" data-slug="${esc(t.slug)}">
      <div class="pair">
        <div class="side tw"><span class="mark">✅</span><span class="word">${tw}</span></div>
        <div class="side cn"><span class="mark">❌</span><span class="word">${cn}</span></div>
      </div>
      <div class="meta">
        <span class="tag type">${typeLabel[t.type] ?? esc(t.type)}</span>
        ${ctx}
        <span class="tag band ${b}">${bandLabel[b]} ${pct}%</span>
      </div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      ${note}
    </article>`;
}

const sections = catOrder
  .filter((c) => grouped.has(c))
  .map((c) => {
    const list = grouped.get(c);
    return `
    <section class="cat" id="cat-${esc(c)}">
      <h2>${esc(catName.get(c) ?? c)} <span class="count">${list.length}</span></h2>
      <div class="grid">${list.map(card).join('')}</div>
    </section>`;
  })
  .join('');

const nav = catOrder
  .filter((c) => grouped.has(c))
  .map((c) => `<a href="#cat-${esc(c)}">${esc(catName.get(c) ?? c)}</a>`)
  .join('');

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TaiWords 圖鑑 — 兩岸用語對照</title>
<meta name="description" content="台灣慣用詞 vs 中國用語對照圖鑑，共 ${total} 條，依信心度分級、爭議詞明確標示。">
<style>
  :root {
    --bg:#0f172a; --card:#ffffff; --ink:#0f172a; --sub:#64748b;
    --tw:#16a34a; --cn:#dc2626; --line:#e2e8f0;
    --high:#dc2626; --mid:#f59e0b; --low:#94a3b8;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"PingFang TC","Noto Sans TC",system-ui,-apple-system,sans-serif; color:var(--ink); background:#f8fafc; line-height:1.5; }
  header.hero { background:var(--bg); color:#fff; padding:32px 20px 24px; }
  header.hero .wrap { max-width:1100px; margin:0 auto; }
  header.hero h1 { margin:0; font-size:26px; display:flex; align-items:center; gap:10px; }
  header.hero .badge { font-size:13px; background:#fff; color:var(--bg); padding:3px 8px; border-radius:5px; }
  header.hero p { margin:8px 0 0; color:#cbd5e1; font-size:14px; }
  header.hero .stats { margin-top:14px; display:flex; gap:18px; font-size:13px; color:#94a3b8; flex-wrap:wrap; }
  header.hero .stats b { color:#fff; font-size:16px; }
  header.hero .cta { margin-top:14px; }
  header.hero .cta a { color:#fbbf24; text-decoration:none; font-size:14px; font-weight:500; }
  header.hero .cta a:hover { text-decoration:underline; }

  nav.cats { position:sticky; top:0; z-index:10; background:#fff; border-bottom:1px solid var(--line); padding:10px 20px; overflow-x:auto; white-space:nowrap; }
  nav.cats .wrap { max-width:1100px; margin:0 auto; display:flex; gap:6px; }
  nav.cats a { font-size:13px; color:var(--sub); text-decoration:none; padding:5px 10px; border-radius:14px; background:#f1f5f9; }
  nav.cats a:hover { background:#e2e8f0; color:var(--ink); }

  main { max-width:1100px; margin:0 auto; padding:20px; }
  section.cat { margin-bottom:28px; scroll-margin-top:56px; }
  section.cat h2 { font-size:18px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
  section.cat h2 .count { font-size:12px; color:var(--sub); background:#f1f5f9; padding:2px 8px; border-radius:10px; font-weight:400; }

  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px; }
  .card.low { background:#fafafa; border-style:dashed; }

  .pair { display:flex; flex-direction:column; gap:4px; }
  .side { display:flex; align-items:center; gap:8px; font-size:18px; }
  .side .mark { font-size:15px; }
  .side.tw .word { color:var(--tw); font-weight:700; }
  .side.cn .word { color:var(--cn); text-decoration:line-through; text-decoration-color:rgba(220,38,38,.4); }

  .meta { display:flex; flex-wrap:wrap; gap:5px; }
  .tag { font-size:11px; padding:2px 7px; border-radius:4px; background:#f1f5f9; color:var(--sub); }
  .tag.ctx { background:#fef3c7; color:#92400e; }
  .tag.band.high { background:rgba(220,38,38,.10); color:var(--high); }
  .tag.band.mid { background:rgba(245,158,11,.12); color:#b45309; }
  .tag.band.low { background:#f1f5f9; color:var(--low); }

  .bar { height:4px; background:#f1f5f9; border-radius:2px; overflow:hidden; }
  .bar span { display:block; height:100%; background:var(--high); }
  .card.mid .bar span { background:var(--mid); }
  .card.low .bar span { background:var(--low); }

  .note { margin:0; font-size:12px; color:var(--sub); white-space:pre-wrap; }

  footer { max-width:1100px; margin:0 auto; padding:24px 20px 40px; color:var(--sub); font-size:12px; border-top:1px solid var(--line); }
  footer a { color:#475569; }
</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <h1>TaiWords <span class="badge">台詞</span> 圖鑑</h1>
    <p>台灣慣用詞 vs 中國用語對照。資料依信心度分級，<b style="color:#fbbf24">爭議詞明確標示</b>——不是一張沒來源的清單。</p>
    <div class="stats">
      <span><b>${total}</b> 條詞彙</span>
      <span><b>${grouped.size}</b> 個分類</span>
      <span><b>${disputed}</b> 條標為爭議/參考（信心度 &lt; 50%）</span>
    </div>
    <p class="cta"><a href="cards.html">→ 卡片產生器：選分類匯出 PNG，分享到 Threads / IG</a></p>
  </div>
</header>
<nav class="cats"><div class="wrap">${nav}</div></nav>
<main>${sections}</main>
<footer>
  資料來源與授權見
  <a href="https://github.com/jimmyhusaas/taiwords/blob/main/docs/04-data-sources.md">data-sources</a>，
  詞庫 CC-BY-SA-4.0。信心度為人工標註，歡迎於
  <a href="https://github.com/jimmyhusaas/taiwords">GitHub</a> 回報修正。
  · 由 data/seed/*.yaml 自動產生
</footer>
</body>
</html>`;

mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
writeFileSync(resolve(__dirname, 'dist/index.html'), html, 'utf8');
console.log(`圖鑑已產生：dist/index.html（${total} 條、${grouped.size} 分類、${disputed} 條爭議）`);

// ─── 卡片產生器 ───────────────────────────────────────────
// 純前端，html2canvas 把 DOM 截成 PNG。使用者選分類 / 比例 / 信心度門檻，
// 即時預覽，按一鍵下載 1080px 解析度卡片，丟 Threads / IG 用。
const cardData = {
  categories: categories.map((c) => ({ slug: c.slug, name: c.nameZhTw ?? c.name_zh_tw })),
  // 卡片只用得到這四個欄位，序列化精簡一點，HTML 也小一點
  terms: terms.map((t) => ({
    tw: t.canonical_zh_tw,
    cn: t.canonical_zh_cn,
    conf: t.confidence ?? 0,
    cats: t.categories ?? [],
  })),
};

const cardsHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TaiWords 卡片產生器</title>
<meta name="description" content="從 TaiWords 圖鑑挑一個分類，匯出可分享到 Threads / IG 的對照卡片 PNG。">
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>
  :root { --bg:#0f172a; --ink:#0f172a; --sub:#64748b; --line:#e2e8f0; --tw:#16a34a; --cn:#dc2626; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"PingFang TC","Noto Sans TC",system-ui,-apple-system,sans-serif; background:#f1f5f9; color:var(--ink); }

  header.bar { background:var(--bg); color:#fff; padding:16px 20px; }
  header.bar .wrap { max-width:1200px; margin:0 auto; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  header.bar h1 { margin:0; font-size:18px; }
  header.bar .badge { font-size:12px; background:#fff; color:var(--bg); padding:2px 7px; border-radius:5px; }
  header.bar a { color:#cbd5e1; text-decoration:none; font-size:13px; margin-left:auto; }
  header.bar a:hover { color:#fff; }

  main { max-width:1200px; margin:0 auto; padding:20px; display:grid; grid-template-columns:300px 1fr; gap:24px; }
  @media (max-width:760px) { main { grid-template-columns:1fr; } }

  .panel { background:#fff; border:1px solid var(--line); border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:14px; align-self:start; }
  .panel h2 { margin:0; font-size:14px; color:var(--sub); font-weight:600; }
  .field label { display:block; font-size:12px; color:var(--sub); margin-bottom:5px; font-weight:500; }
  .field select, .field input[type=text] { width:100%; padding:7px 10px; font-size:13px; border:1px solid var(--line); border-radius:6px; font-family:inherit; }
  .field input[type=range] { width:100%; }
  .row { display:flex; gap:8px; align-items:baseline; font-size:11px; color:var(--sub); }
  .row b { color:var(--ink); font-variant-numeric:tabular-nums; }
  .ratio-btns { display:flex; gap:6px; }
  .ratio-btns button { flex:1; padding:6px 8px; font-size:12px; border:1px solid var(--line); border-radius:5px; background:#fff; cursor:pointer; font-family:inherit; }
  .ratio-btns button.on { background:var(--bg); color:#fff; border-color:var(--bg); }
  .download { background:var(--bg); color:#fff; border:0; padding:10px 14px; font-size:14px; font-weight:600; border-radius:6px; cursor:pointer; font-family:inherit; }
  .download:disabled { background:#94a3b8; cursor:wait; }
  .download:hover:not(:disabled) { background:#1e293b; }
  .hint { font-size:11px; color:var(--sub); margin:0; line-height:1.5; }

  .preview-wrap { display:flex; justify-content:center; align-items:flex-start; padding:20px; background:#fff; border:1px solid var(--line); border-radius:10px; overflow:auto; }
  .preview-scaler { transform-origin:top center; }

  /* 卡片本身：實際 1080px 寬，主題以 CSS variable 切換，比例靠 height + 排版間距 */
  .card {
    width:1080px;
    --c-bg: #0f172a;
    --c-bg-gradient: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #334155 100%);
    --c-ink: #ffffff;
    --c-sub: #94a3b8;
    --c-foot: #cbd5e1;
    --c-tw: #86efac;
    --c-cn: #fca5a5;
    --c-arrow: #64748b;
    --c-accent: #fbbf24;
    --c-brand-tag-bg: #ffffff;
    --c-brand-tag-ink: #0f172a;
    --c-glow: rgba(251,191,36,0.18);

    background: var(--c-bg-gradient);
    color: var(--c-ink);
    padding:72px 80px;
    font-family:"PingFang TC","Noto Sans TC",system-ui,sans-serif;
    display:flex;
    flex-direction:column;
    box-sizing:border-box;
    position:relative;
    overflow:hidden;
  }
  .card::before {
    content:""; position:absolute; top:-140px; right:-140px;
    width:500px; height:500px; border-radius:50%;
    background:radial-gradient(circle, var(--c-glow) 0%, transparent 70%);
    pointer-events:none;
  }

  /* ── 主題 ─────────────────────────────────────────── */
  /* t-punch：預設深色漸層，最像病毒貼文 */
  .card.t-punch {
    --c-bg-gradient: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #334155 100%);
    --c-ink:#ffffff; --c-sub:#94a3b8; --c-foot:#cbd5e1;
    --c-tw:#86efac; --c-cn:#fca5a5; --c-arrow:#64748b;
    --c-accent:#fbbf24;
    --c-brand-tag-bg:#ffffff; --c-brand-tag-ink:#0f172a;
    --c-glow: rgba(251,191,36,0.18);
  }
  /* t-light：白底備忘錄風，乾淨易讀 */
  .card.t-light {
    --c-bg-gradient: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    --c-ink:#0f172a; --c-sub:#64748b; --c-foot:#475569;
    --c-tw:#15803d; --c-cn:#b91c1c; --c-arrow:#94a3b8;
    --c-accent:#0f172a;
    --c-brand-tag-bg:#0f172a; --c-brand-tag-ink:#ffffff;
    --c-glow: rgba(15,23,42,0.06);
  }
  /* t-mute：米色文青低彩度 */
  .card.t-mute {
    --c-bg-gradient: linear-gradient(160deg, #fef7ed 0%, #fef3c7 50%, #fde68a 100%);
    --c-ink:#1c1917; --c-sub:#78716c; --c-foot:#44403c;
    --c-tw:#166534; --c-cn:#9a3412; --c-arrow:#a8a29e;
    --c-accent:#7c2d12;
    --c-brand-tag-bg:#1c1917; --c-brand-tag-ink:#fef7ed;
    --c-glow: rgba(124,45,18,0.10);
  }

  /* ── 卡片內部組件 ─────────────────────────────────── */
  .card .head { position:relative; z-index:1; margin-bottom:56px; }
  .card .brand { font-size:42px; font-weight:800; display:flex; align-items:center; gap:16px; letter-spacing:-0.5px; }
  .card .brand .b-tag { font-size:26px; background:var(--c-brand-tag-bg); color:var(--c-brand-tag-ink); padding:6px 16px; border-radius:8px; font-weight:700; }
  .card .cat-name { margin-top:24px; font-size:78px; font-weight:800; letter-spacing:-2px; line-height:1.05; }
  .card .title { margin-top:18px; font-size:34px; color:var(--c-accent); font-weight:500; }

  .card .list { position:relative; z-index:1; flex:1; display:flex; flex-direction:column; gap:28px; justify-content:center; }
  .card .item { display:flex; align-items:center; gap:28px; font-size:48px; font-weight:600; line-height:1.2; }
  .card .item .arrow { color:var(--c-arrow); font-size:34px; font-weight:400; }
  .card .item .tw { color:var(--c-tw); display:flex; align-items:center; gap:16px; min-width:0; }
  .card .item .cn { color:var(--c-cn); text-decoration:line-through; text-decoration-color:color-mix(in srgb, var(--c-cn) 50%, transparent); display:flex; align-items:center; gap:16px; min-width:0; }
  .card .item .check { font-size:40px; }

  /* ── 浮水印 / QR ───────────────────────────────────── */
  .card .foot { position:relative; z-index:1; margin-top:56px; display:flex; justify-content:space-between; align-items:flex-end; gap:24px; }
  .card .foot .info { display:flex; flex-direction:column; gap:8px; flex:1; min-width:0; }
  .card .foot .site { font-size:28px; font-weight:700; color:var(--c-foot); }
  .card .foot .meta { font-size:20px; color:var(--c-sub); }
  .card .foot .qr-wrap { background:#fff; padding:14px; border-radius:14px; display:flex; flex-direction:column; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
  .card .foot .qr-wrap canvas { display:block; image-rendering:pixelated; }
  .card .foot .qr-wrap .scan-hint { font-size:14px; color:#0f172a; font-weight:600; }

  /* ── 比例：1:1 / 4:5 / 9:16 ───────────────────────────
     9:16 字級加大、間距撐開，避免高度多出來變空白。 */
  .card.r-1x1 { height:1080px; }
  .card.r-4x5 { height:1350px; }
  .card.r-9x16 {
    height:1920px; padding:96px 96px;
  }
  .card.r-9x16 .cat-name { font-size:104px; }
  .card.r-9x16 .title { font-size:44px; margin-top:24px; }
  .card.r-9x16 .brand { font-size:54px; }
  .card.r-9x16 .brand .b-tag { font-size:34px; padding:8px 20px; }
  .card.r-9x16 .list { gap:44px; justify-content:space-around; }
  .card.r-9x16 .item { font-size:60px; gap:36px; }
  .card.r-9x16 .item .check { font-size:50px; }
  .card.r-9x16 .item .arrow { font-size:42px; }
  .card.r-9x16 .foot { margin-top:56px; }
  .card.r-9x16 .foot .site { font-size:36px; }
  .card.r-9x16 .foot .meta { font-size:24px; }

  .empty { text-align:center; padding:40px 20px; color:var(--sub); font-size:14px; }
</style>
</head>
<body>

<header class="bar">
  <div class="wrap">
    <h1>TaiWords <span class="badge">台詞</span> 卡片產生器</h1>
    <a href="index.html">← 回圖鑑</a>
  </div>
</header>

<main>
  <aside class="panel">
    <h2>① 分類</h2>
    <div class="field">
      <select id="cat"></select>
    </div>

    <h2>② 比例</h2>
    <div class="ratio-btns">
      <button data-ratio="1x1" class="on">1:1 IG</button>
      <button data-ratio="4x5">4:5 IG</button>
      <button data-ratio="9x16">9:16 Stories</button>
    </div>

    <h2>③ 主題</h2>
    <div class="ratio-btns" id="theme-btns">
      <button data-theme="t-punch" class="on">爆款</button>
      <button data-theme="t-light">白底</button>
      <button data-theme="t-mute">低調</button>
    </div>

    <h2>④ 條件</h2>
    <div class="field">
      <label>標題 (可改)</label>
      <input id="title" type="text" value="我們說 ✅ 不說 ❌">
    </div>
    <div class="field">
      <label>每張顯示筆數 <b id="n-val">10</b></label>
      <input id="n" type="range" min="5" max="14" step="1" value="10">
    </div>
    <div class="field">
      <label>最低信心度 <b id="conf-val">0.70</b></label>
      <input id="conf" type="range" min="0.3" max="1" step="0.05" value="0.7">
    </div>
    <p class="hint">信心度 ≥ 0.7 是公認支語，0.5–0.7 多為灰色詞，&lt; 0.5 為爭議/迷思詞（預設排除）。</p>

    <button class="download" id="download">下載 PNG</button>
    <p class="hint">PNG 為 1080px 寬，可直接上傳 IG / Threads。檔名含分類與比例。</p>
  </aside>

  <section class="preview-wrap">
    <div class="preview-scaler">
      <div id="card" class="card r-1x1"></div>
    </div>
  </section>
</main>

<script type="application/json" id="data">${JSON.stringify(cardData)}</script>
<script>
(function () {
  const data = JSON.parse(document.getElementById('data').textContent);
  const sel = document.getElementById('cat');
  const ratioBtns = document.querySelectorAll('main > aside .ratio-btns:not(#theme-btns) button');
  const themeBtns = document.querySelectorAll('#theme-btns button');
  const titleInput = document.getElementById('title');
  const nInput = document.getElementById('n');
  const nVal = document.getElementById('n-val');
  const confInput = document.getElementById('conf');
  const confVal = document.getElementById('conf-val');
  const card = document.getElementById('card');
  const scaler = document.querySelector('.preview-scaler');
  const previewWrap = document.querySelector('.preview-wrap');
  const dlBtn = document.getElementById('download');

  // QR 指向 repo（部署到 Vercel/GitHub Pages 後可改成圖鑑站 URL）
  const QR_TARGET = 'https://github.com/jimmyhusaas/taiwords';

  let state = { cat: data.categories[0]?.slug ?? '', ratio: '1x1', theme: 't-punch' };

  // 填分類下拉，標註每類筆數（>=0.5 default）
  data.categories.forEach((c) => {
    const count = data.terms.filter((t) => t.cats.includes(c.slug) && t.conf >= 0.5).length;
    const opt = document.createElement('option');
    opt.value = c.slug;
    opt.textContent = \`\${c.name} (\${count})\`;
    sel.appendChild(opt);
  });

  function render() {
    const minConf = parseFloat(confInput.value);
    const n = parseInt(nInput.value, 10);
    // 卡片視覺要 1:1 對照才有梗，cn_only（左邊「(無對應)」）排後面
    const isCounterpart = (t) => !t.tw.startsWith('（無對應') && !t.tw.startsWith('(無對應');
    const subset = data.terms
      .filter((t) => t.cats.includes(state.cat) && t.conf >= minConf)
      .sort((a, b) => {
        const ac = isCounterpart(a) ? 1 : 0;
        const bc = isCounterpart(b) ? 1 : 0;
        if (ac !== bc) return bc - ac;            // 有對照的優先
        return b.conf - a.conf;                   // 同類再按信心度
      })
      .slice(0, n);

    const catName = data.categories.find((c) => c.slug === state.cat)?.name ?? state.cat;

    card.className = 'card r-' + state.ratio + ' ' + state.theme;
    if (subset.length === 0) {
      card.innerHTML = '<div class="empty" style="color:inherit;font-size:38px;padding:80px;text-align:center">此分類在此信心度門檻下沒有詞彙，請降低門檻或換分類。</div>';
      return;
    }

    card.innerHTML = \`
      <div class="head">
        <div class="brand">TaiWords <span class="b-tag">台詞</span></div>
        <div class="cat-name">\${esc(catName)}</div>
        <div class="title">\${esc(titleInput.value)}</div>
      </div>
      <div class="list">
        \${subset.map((t) => {
          const tw = t.tw.startsWith('（無') || t.tw.startsWith('(無') ? '（無對應）' : t.tw;
          return \`
          <div class="item">
            <span class="tw"><span class="check">✅</span>\${esc(tw)}</span>
            <span class="arrow">←→</span>
            <span class="cn"><span class="check">❌</span>\${esc(t.cn)}</span>
          </div>\`;
        }).join('')}
      </div>
      <div class="foot">
        <div class="info">
          <span class="site">github.com/jimmyhusaas/taiwords</span>
          <span class="meta">\${subset.length} 條 · 信心度 ≥ \${minConf.toFixed(2)} · 共 \${data.terms.length} 條圖鑑</span>
        </div>
        <div class="qr-wrap">
          <canvas id="qr-canvas"></canvas>
          <span class="scan-hint">看完整圖鑑</span>
        </div>
      </div>\`;

    // 渲染 QR code 到 canvas。size 隨比例調整，9:16 較大。
    const qrSize = state.ratio === '9x16' ? 220 : 170;
    const canvas = card.querySelector('#qr-canvas');
    if (canvas && window.QRCode) {
      QRCode.toCanvas(canvas, QR_TARGET, {
        width: qrSize,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }, (err) => { if (err) console.error('QR error', err); });
    }

    fitPreview();
  }

  // 把卡片縮放到 preview 容器寬度
  function fitPreview() {
    const wrap = previewWrap.getBoundingClientRect();
    const target = Math.min(wrap.width - 40, 480);
    const scale = target / 1080;
    scaler.style.transform = \`scale(\${scale})\`;
    // 容器高度跟著縮：1080 寬 * scale = target；高度按比例 * scale
    const h = state.ratio === '1x1' ? 1080 : state.ratio === '4x5' ? 1350 : 1920;
    scaler.style.height = (h * scale) + 'px';
    scaler.style.width = '1080px';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }

  // events
  sel.addEventListener('change', () => { state.cat = sel.value; render(); });
  titleInput.addEventListener('input', render);
  nInput.addEventListener('input', () => { nVal.textContent = nInput.value; render(); });
  confInput.addEventListener('input', () => { confVal.textContent = parseFloat(confInput.value).toFixed(2); render(); });
  ratioBtns.forEach((b) => b.addEventListener('click', () => {
    state.ratio = b.dataset.ratio;
    ratioBtns.forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));
  themeBtns.forEach((b) => b.addEventListener('click', () => {
    state.theme = b.dataset.theme;
    themeBtns.forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));
  window.addEventListener('resize', fitPreview);

  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.textContent = '生成中…';
    try {
      // 截 PNG 前暫時 unscale 到 1:1，截完還原
      const prev = scaler.style.transform;
      scaler.style.transform = 'scale(1)';
      const canvas = await html2canvas(card, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        logging: false,
      });
      scaler.style.transform = prev;
      fitPreview();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`taiwords-\${state.cat}-\${state.ratio}.png\`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('生成失敗：' + e.message);
      console.error(e);
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = '下載 PNG';
    }
  });

  render();
})();
</script>
</body>
</html>`;

writeFileSync(resolve(__dirname, 'dist/cards.html'), cardsHtml, 'utf8');
console.log(`卡片產生器已產生：dist/cards.html`);
