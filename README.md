# TaiWords — 台詞

> **台詞**＝**台**灣慣用詞 × Tai**Words**。
> 一個幫助你辨識中文文本中「疑似支語」並建議台灣慣用詞的工具：圖鑑 + 偵測器 + Chrome 擴充套件。

[![CI](https://github.com/jimmyhu/taiwords/actions/workflows/ci.yml/badge.svg)](https://github.com/jimmyhu/taiwords/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Data: CC-BY-SA-4.0](https://img.shields.io/badge/Data-CC--BY--SA--4.0-orange.svg)](docs/04-data-sources.md)

---

## 目標

1. 建立一個**結構化、可長期維護**的兩岸用語對照圖鑑
2. 提供 **REST API** 讓任何應用程式都能查詢與偵測
3. 推出 **Chrome 擴充套件**，瀏覽網頁時即時標出支語並提示台灣慣用詞
4. 提供 **Web 介面**，讓使用者可貼上文章 / 逐字稿做分析

## 文件導覽

| 文件 | 用途 |
| --- | --- |
| [docs/01-architecture.md](docs/01-architecture.md) | 系統架構、技術選型、模組分工 |
| [docs/02-data-schema.md](docs/02-data-schema.md) | 圖鑑資料結構（詞條、類別、信心度） |
| [docs/03-roadmap.md](docs/03-roadmap.md) | MVP 範圍、Phase 切割、里程碑 |
| [docs/04-data-sources.md](docs/04-data-sources.md) | 開源資料清單與授權說明 |
| [docs/05-quickstart.md](docs/05-quickstart.md) | 本地 5 分鐘起跑指南（含預期輸出） |
| [services/api/README.md](services/api/README.md) | API 服務開發 / 部署說明 |
| [apps/extension/README.md](apps/extension/README.md) | Chrome 擴充套件開發說明 |
| [data/seed/terms.yaml](data/seed/terms.yaml) | 種子詞庫（200 條） |
| [data/seed/categories.yaml](data/seed/categories.yaml) | 詞彙分類 |

## 專案結構

```
taiwords/
├── docs/                    # 設計文件
├── data/seed/               # 種子詞庫（YAML，啟動時載入 DB）
├── services/
│   └── api/                 # Spring Boot 3 + Java 21 API
├── apps/                    # （Phase 2+）Chrome Ext / Web Frontend
│   ├── extension/           # Chrome Extension (TS)（規劃中）
│   └── web/                 # Next.js 圖鑑（規劃中）
└── docker-compose.yml       # 本地開發堆疊
```

## 快速開始

```bash
# 啟動 PostgreSQL + API
docker compose up -d

# 等 API 啟動完成（約 20 秒）
curl http://localhost:8080/api/v1/healthz

# 查所有詞條
curl http://localhost:8080/api/v1/terms

# 偵測一段文字
curl -X POST http://localhost:8080/api/v1/detect \
  -H 'Content-Type: application/json' \
  -d '{"text":"這個視頻的高清畫質很給力"}'

# 互動式 API 文件
open http://localhost:8080/swagger-ui.html
```

詳細開發指南見 [services/api/README.md](services/api/README.md)。

## 技術棧

| 層級 | 技術 | 為什麼 |
| --- | --- | --- |
| API | Java 21 + Spring Boot 3.3 | 後端主力語言，貼合既有強項 |
| DB | PostgreSQL 17 + Flyway | 強結構、ACID、版本化 schema |
| Build | Gradle Kotlin DSL | 型別安全、現代化 build script |
| NLP (Phase 4) | Python 3.12 + FastAPI | jieba / ckip-transformers 生態 |
| Frontend (Phase 3) | Next.js 14 + Tailwind | App Router、SSR、SEO 友善 |
| Extension (Phase 2) | TypeScript + WXT | 跨瀏覽器、現代 Manifest V3 |
| Cache | Redis | 詞庫熱資料、偵測結果快取 |

完整架構決策見 [docs/01-architecture.md](docs/01-architecture.md)。

## 為什麼這個專案

- **語言主體性**：兩岸用語混用日漸普遍，工具讓使用者自己判斷取捨，而非被動接受
- **技術練習**：多服務 polyglot 架構、Chrome Extension、NLP、Docker / K8s 完整鏈條
- **可發表 portfolio**：開源 + 實用 + 議題性，能在求職時清楚展示能力

## 貢獻

歡迎提交詞條修正、新增詞條、回報誤判。貢獻指南見 [CONTRIBUTING.md](CONTRIBUTING.md)（規劃中）。

## 授權

- **程式碼**：[MIT](LICENSE)
- **詞庫資料**：CC-BY-SA-4.0（與 g0v 等資料來源相容）
