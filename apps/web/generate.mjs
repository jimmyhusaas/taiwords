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
