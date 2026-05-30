# taiwords-web

TaiWords 圖鑑（網頁版）。

## 現況：靜態 v0

`generate.mjs` 讀 repo 根的 `data/seed/{categories,terms}.yaml`（與 API 共用的單一真實來源），
產出自包含的 `dist/index.html`：兩岸用語對照卡片，按分類分區，每張卡帶信心度色條與爭議標籤。

採用社群瘋傳的「✅台灣詞 ❌中國詞」格式（易截圖分享），但比病毒貼文多了 rigor——
信心度分級、爭議詞（信心度 < 50%）明確標示，不假裝每條都是鐵板釘釘的支語。

```bash
pnpm install
pnpm build          # 產生 dist/index.html
pnpm serve          # 產生並起本地 http server (port 4173)
```

## Phase 3 規劃

升級為 Next.js 14：
- `/dict` 圖鑑列表（搜尋、分類篩選）
- `/dict/[slug]` 單一詞條詳情（例句、來源、相關詞）
- 每條獨立 OG image，SEO（讓 Google 搜「視頻 影片」找得到）
- 部署 Vercel

靜態 v0 先驗證資料呈現與卡片設計，Next.js 版沿用同一份 YAML 資料源。
