# taiwords-extension

TaiWords 的 Chrome 擴充套件，使用 [WXT](https://wxt.dev/) + TypeScript 開發。

## 狀態

Phase 2 起手雛型。最小可用功能：

- 每個網頁右下角注入「台詞 ⚑」浮動按鈕
- 點擊 → 抓取頁面前 8,000 字 → 送往本地 API `POST /api/v1/detect`
- 用瀏覽器原生 `alert` 顯示前 12 筆疑似支語與台灣建議詞

後續 Phase 2 任務：inline 標記（底線 + tooltip）、popup 顯示細節、白名單網域、選項頁 `min_confidence`。

## 開發

需要本地 TaiWords API 跑著（從 repo 根）：

```bash
docker compose up -d
curl http://localhost:8080/api/v1/healthz
```

然後跑擴充套件 dev mode（會自動啟動 Chromium 並側載擴充套件）：

```bash
cd apps/extension
pnpm install
pnpm dev
```

`pnpm dev:firefox` 跑 Firefox 版本（manifest v2 兼容版本由 WXT 處理）。

## 編譯型別檢查

```bash
pnpm compile
```

## 建置打包

```bash
pnpm build          # 產出 .output/chrome-mv3/
pnpm zip            # 打包成 .output/*.zip 給 Chrome Web Store
```

## 目錄結構

```
apps/extension/
├── package.json
├── tsconfig.json
├── wxt.config.ts
└── entrypoints/
    ├── content.ts                 # 注入浮動按鈕 + 呼叫 detect API
    └── popup/
        ├── index.html
        └── main.ts
```

WXT 會在 `pnpm install`（postinstall）時生成 `.wxt/` 目錄與 manifest，被 `.gitignore` 忽略。
