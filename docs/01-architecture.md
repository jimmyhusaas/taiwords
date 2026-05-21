# 系統架構設計

## 1. 設計目標與限制

### 1.1 功能目標
- **F1**：輸入一段文字，能標出「疑似支語」並建議台灣慣用詞與信心度
- **F2**：提供圖鑑查詢（依分類、依關鍵字、依地區）
- **F3**：使用者瀏覽網頁時，能在頁面上即時標示支語
- **F4**（後期）：使用者貢獻/校對詞條（社群協作）

### 1.2 非功能目標
- **N1**：偵測延遲 < 500ms（一段 1000 字的文章）
- **N2**：詞庫可在不重新部署的情況下熱更新
- **N3**：API 可獨立部署，未來能換掉前端 / Chrome Ext 而不動到後端
- **N4**：所有元件可在單機 Docker Compose 起來，也可上 K8s

### 1.3 顯式不做（Non-goals）
- ❌ 不做語音轉文字（直接接受文字輸入；語音場景由前端用 Web Speech API 自行轉換）
- ❌ 初期不做使用者帳號系統
- ❌ 不做政治判斷或情緒分析，只標記語言來源

---

## 2. 整體架構

```
┌──────────────────────────┐    ┌──────────────────────────┐
│   Chrome Extension       │    │   Web Frontend (Next.js) │
│   - content script       │    │   - 貼文章/逐字稿        │
│   - popup                │    │   - 視覺化結果           │
│   - 設定面板             │    │   - 圖鑑瀏覽             │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                                │
             └────────────┬───────────────────┘
                          │  HTTPS / JSON
                          ▼
            ┌────────────────────────────┐
            │   API Gateway (Spring Boot)│
            │   ─────────────────────────│
            │   - REST endpoints         │
            │   - rate limiting          │
            │   - 認證（後期 OAuth）     │
            │   - 詞庫 CRUD              │
            │   - 結果快取（Redis）      │
            └─────────┬──────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌─────────────────┐         ┌─────────────────────┐
│ NLP Service     │         │ PostgreSQL          │
│ (FastAPI / Py)  │         │  ─────────────────  │
│ ─────────────── │         │  - terms（詞條）    │
│ - 中文斷詞       │         │  - categories       │
│ - 多詞匹配       │         │  - sources（來源）  │
│ - 上下文消歧     │         │  - revisions（版本）│
│ - 信心度計算     │         └─────────────────────┘
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Redis Cache     │
│ - 詞庫熱資料    │
│ - 偵測結果快取  │
└─────────────────┘
```

---

## 3. 模組分工

### 3.1 Chrome Extension (`apps/extension`)
- **技術**：TypeScript + Vite + WXT（或 Plasmo）
- **責任**：
  - `content.ts`：掃描頁面文字節點，呼叫 API 取得偵測結果，在文字上加上標記（底線/tooltip）
  - `popup.tsx`：顯示這個頁面共標出多少個支語、開關功能
  - `options.tsx`：設定靈敏度、白名單、自訂詞庫
- **與 API 的契約**：批次送出文字片段，回傳 `[{ start, end, suggested, confidence, category }]`

### 3.2 Web Frontend (`apps/web`)
- **技術**：Next.js 14（App Router） + Tailwind + shadcn/ui
- **頁面**：
  - `/` → 偵測器（貼文章 → 顯示結果）
  - `/dict` → 圖鑑（搜尋、分類瀏覽、隨機卡片）
  - `/dict/[term]` → 單一詞條詳情頁
  - `/about` → 專案說明、資料來源、授權
- **未來**：`/contribute` 讓使用者提交修正建議

### 3.3 API Service (`services/api`)
- **技術**：Java 21 + Spring Boot 3 + Spring Data JPA + Flyway
- **REST 端點**：
  ```
  GET    /api/v1/terms                  # 列表查詢（支援分類、關鍵字）
  GET    /api/v1/terms/{id}             # 單一詞條詳情
  POST   /api/v1/detect                 # 偵測（body: {text, options}）
  POST   /api/v1/detect/batch           # 批次偵測（給 Chrome Ext 用）
  GET    /api/v1/categories             # 分類清單
  GET    /api/v1/healthz                # 健康檢查
  ```
- **與 NLP Service 的介面**：內部 HTTP（後期可換 gRPC）

### 3.4 NLP Service (`services/nlp`)
- **技術**：Python 3.12 + FastAPI + jieba（基礎）+ ckip-transformers（精準斷詞，可選）
- **責任**：
  1. 把輸入文字斷詞（含繁簡轉換正規化）
  2. 以 Aho-Corasick 自動機做高效多模式比對
  3. 依詞條的「同名異實」標記做上下文檢查
  4. 回傳結構化結果

### 3.5 Data Store
- **PostgreSQL** — 詞條主資料庫
- **Redis** — 詞庫快取（啟動時從 DB load） + 偵測結果快取（同樣文字 5 分鐘內回相同結果）

---

## 4. 為什麼這樣選

| 決策 | 為什麼 | 取捨 |
| --- | --- | --- |
| Java/Spring Boot 做 API | 貼合使用者現有強項，練 REST/JPA/Flyway 完整鏈 | 啟動較慢、開發迭代不如 Node |
| 拆出 Python NLP 微服務 | jieba/ckip 生態只在 Python 成熟；強迫練微服務通訊 | 多一層部署複雜度 |
| Chrome Ext 用 TS（不用 Java） | 瀏覽器原生語言；可與 web 前端共享型別 | 多一個語言 |
| PostgreSQL 而非 NoSQL | 詞條結構固定且關聯強（詞 ↔ 分類 ↔ 來源） | 需要設計 schema |
| 詞庫熱更新走 Redis pub/sub | 不需重啟服務即可更新 | 多一個一致性層要處理 |

---

## 5. 部署拓樸

### 5.1 本地開發
```bash
docker compose up   # 啟動 postgres / redis / api / nlp / web
```

### 5.2 雲端（Phase 3）
- API + NLP：Fly.io / Railway / 自架 K8s
- Postgres：Neon / Supabase
- Redis：Upstash
- Chrome Ext：發佈到 Chrome Web Store（免費帳號 $5 一次性）

---

## 6. 後續決策待辦

- [ ] 是否引入 Elasticsearch 做圖鑑搜尋？（先用 PostgreSQL full-text search 撐到 1 萬詞）
- [ ] 上下文消歧要不要上小型 LLM（Llama 3 8B in Ollama）？
- [ ] 使用者貢獻流程：直接 PR 還是內建後台？
- [ ] 收集匿名統計（哪個詞最常被標）需要哪些隱私處理？
