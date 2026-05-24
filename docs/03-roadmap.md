# 開發 Roadmap

> 設計原則：**MVP 先驗證價值，再投入工程深度**。
> 每個 Phase 都要能獨立 demo，並產出可放進 portfolio 的成果。

---

## 0. 北極星指標（North Star）

- **短期（6 個月）**：能在 Chrome 上即時標出一篇中文文章裡的「疑似支語」，且使用者願意安裝。
- **中期（12 個月）**：詞庫 ≥ 3,000 條，社群可貢獻校對，GitHub Star ≥ 200。
- **長期**：成為「兩岸華語差異」相關討論時，第一個被引用的開源工具。

---

## 1. Phase 切割

### Phase 0 — 規劃（**完成**）
**目標**：架構文件、資料 schema、種子詞庫，能說清楚要做什麼。

- [x] 寫 README
- [x] 系統架構（`docs/01-architecture.md`）
- [x] 資料 schema（`docs/02-data-schema.md`）
- [x] Roadmap（本文件）
- [x] 資料來源盤點（`docs/04-data-sources.md`）
- [x] 種子詞庫 v1（`data/seed/terms.yaml`，200 條跨 10 分類）
- [x] 建立 GitHub repo、加 LICENSE（MIT）
- [ ] `CONTRIBUTING.md`（Phase 5 社群協作前補）

**完成標準**：陌生人可以靠這些文件，理解專案要做什麼、為什麼這樣做、怎麼開始貢獻。

---

### Phase 1 — 後端 MVP（**目前所在階段，主要工作完成**）
**目標**：可以用 `curl` 把一段文字打進 API，回傳偵測結果。

#### 工程任務
- [x] Monorepo 初始化（`services/` + `data/`；`apps/` 留待 Phase 2/3）
- [x] Spring Boot 3 + Java 21 專案（`services/api`）
  - [x] Flyway migration（`V1__init_schema.sql` 建表；種子資料由 `SeedLoader` 啟動時 upsert YAML）
  - [x] `GET /api/v1/terms` 列表、`GET /api/v1/terms/{slug}` 詳情、`GET /api/v1/categories`
  - [x] `POST /api/v1/detect`（OpenCC4J t2s 正規化 + long-to-short 字串掃描）
  - [x] OpenAPI（Springdoc）自動文件
- [x] Dockerfile + docker-compose（含 Postgres 17）
- [x] 單元測試覆蓋率 ≥ 60%（核心 `DetectionService` 13 個 case 涵蓋繁簡輸入／邊界／長詞優先；
      `DetectionIntegrationTest` 用 Zonky EmbeddedPostgres 跑 7 個 e2e case；
      尚未跑 jacoco 量化數字，controllers 待補測試）
- [x] GitHub Actions：build + test（包含整合測試）
- [x] GitHub Actions：Docker image push（GHCR）— push 到 main 時推 `ghcr.io/<owner>/taiwords-api:{latest, <sha>}`

#### Demo 標準
```bash
curl -X POST localhost:8080/api/v1/detect \
  -H 'Content-Type: application/json' \
  -d '{"text":"這個視頻的高清畫質很給力"}'
# 回傳：matches 內含 視頻 / 高清 / 給力 三筆
```

#### 故意不做（避免 scope creep）
- 不做 NLP 微服務（用字串掃描 + AC 自動機就好）
- 不做使用者帳號
- 不做圖鑑分頁、不做搜尋進階語法
- 不做前端

---

### Phase 2 — Chrome 擴充套件（3–4 週）
**目標**：使用者裝上後，在新聞網站或社群貼文中能即時標出支語。

#### 工程任務
- [ ] WXT 專案（`apps/extension`，TypeScript）
- [ ] Content script：擷取頁面 text node、批次送 API、回填標記
- [ ] Popup：本頁標記數、開關、白名單網域
- [ ] Options 頁：自訂 `min_confidence` 閾值
- [ ] 視覺：底線 + hover tooltip（顯示建議詞與信心度）
- [ ] 本地快取（IndexedDB）避免重複送同樣段落
- [ ] 隱私：明確聲明「不上傳網頁內容」（API 走本地或自架）

#### Demo 標準
- 在 Yahoo 新聞中文版、PTT、聯合報任一網站，能看到視頻 / 質量 / 軟件被標出來
- 點開 popup 看到本頁標記總數
- 關閉開關後標記消失

#### 故意不做
- 不做 Firefox 版（先聚焦 Chromium）
- 不做匿名統計回傳

---

### Phase 3 — Web 圖鑑（3 週）
**目標**：給沒裝擴充套件的人也能用，並當作專案 landing page。

#### 工程任務
- [ ] Next.js 14 + Tailwind + shadcn/ui（`apps/web`）
- [ ] `/` 偵測器：貼文章 → 視覺化結果（highlight + 信心度色階）
- [ ] `/dict` 圖鑑首頁：依分類、字母排序、搜尋
- [ ] `/dict/[slug]`：單一詞條，含例句、來源、別名、相關詞
- [ ] `/about`：專案說明、資料來源、授權
- [ ] SEO：每個詞條有獨立 OG image
- [ ] 部署到 Vercel（前端）+ Fly.io（API）

#### Demo 標準
- Google 搜「視頻 影片」能在前 20 名看到 `/dict/video-shipin`
- 行動裝置友善（Lighthouse 行動版 ≥ 90）

---

### Phase 4 — NLP 升級（4–6 週）
**目標**：解決「同名異實」與「上下文消歧」，減少誤判。

#### 工程任務
- [ ] FastAPI 微服務（`services/nlp`，Python 3.12）
- [ ] 整合 jieba 或 ckip-transformers 做中文斷詞
- [ ] Aho-Corasick 多模式匹配
- [ ] 上下文規則引擎：依 `context_required=true` 的詞檢查前後 N 字元的特徵
  - 例：「土豆」前後 5 字內若出現「沙拉／薯條／泥／炒」→ 中國語境
- [ ] （可選）整合本地 LLM（Ollama + Llama 3 8B）做語境分類
- [ ] API service 改用 HTTP 呼叫 NLP service
- [ ] 比較指標：F1 score 在自建測試集上的提升

#### 測試集設計
- 從 PTT、噗浪、新聞網站爬 500 篇繁中文章
- 人工標註支語 ground truth
- 建立 regression 測試集，每次模型/規則改動都跑

---

### Phase 5 — 社群協作（持續）
**目標**：詞庫不只靠自己維護。

- [ ] 詞條送出修正建議的 Web 介面（不用先登入）
- [ ] 後台審核流程
- [ ] 詞條 revision 紀錄
- [ ] 接 Discord / Slack webhook 通知有新提案
- [ ] 公開貢獻者排行榜

---

## 2. 里程碑時間軸（樂觀估計）

> 假設每週投入 8–10 小時（下班 + 週末），扣掉學英文與系統設計時間。

| 里程碑 | 預計完成 | 對外可說的話 |
| --- | --- | --- |
| M1：架構文件完整 | 2026 W22 | 「我在規劃一個兩岸語言對照工具」 |
| M2：API MVP 上線（自架） | 2026 Q3 | 「我寫了一個 Spring Boot 後端，可偵測支語」 |
| M3：Chrome 擴充套件公開 beta | 2026 Q4 | 「我做了一個 Chrome Extension，已 N 人安裝」 |
| M4：Web 版上線 | 2027 Q1 | 「上線後 GitHub Star X、月活躍 Y」 |
| M5：NLP 升級完成 | 2027 Q2 | 「我把規則式升級到混合模型，F1 從 X→Y」 |

---

## 3. 風險與緩衝

| 風險 | 緩衝策略 |
| --- | --- |
| 個人時間不穩定 | 每個 Phase 都設定「可中斷點」，半成品也能 demo |
| 詞庫品質爭議 | 引入 `review_status` 機制 + 公開審核流程 + 明確標示來源 |
| 政治敏感 | 政治分類預設 `min_confidence=0.95`、預設關閉；避免標題式對立 |
| 法律授權 | `docs/04-data-sources.md` 明列來源授權，避免引用無授權詞庫 |
| 興趣減退 | 每完成一個 Phase 寫一篇技術文章發布（強迫產出） |

---

## 4. 與職涯目標的對齊

> 此專案同時是「練系統設計」與「做 portfolio」的雙重投資。

| 職涯能力 | 此專案對應練習 |
| --- | --- |
| 系統設計（從會答 → 做過） | 多服務架構、Redis 快取策略、API gateway、熱更新詞庫 |
| 英文輸出 | README / Issue / Release Notes 全用英文寫 |
| 技術可見度 | 上 Chrome Store、開源 repo、寫技術文章 |
| 國際市場切入 | 預留 i18n（雖然主題是中文，但介面語言可英文） |

---

## 5. 下一步（馬上能做的）

Phase 1 收尾完成，下面是 Phase 2 推進：

1. **Phase 2 主軸**：`apps/extension` WXT 骨架已建（右下角浮動按鈕 → 抓頁面文字 → 呼叫本地 detect API）。接下來：
   - inline 標記（底線 + hover tooltip 顯示建議詞與信心度）
   - popup 顯示本頁標記數與 `min_confidence` slider
   - 白名單網域 + IndexedDB 快取
2. **詞庫品質**：200 條中有 ~30 條 confidence 0.3–0.7 的「兩岸都用但中國較常用」詞，Phase 5 社群協作上線時引入 `review_status` 工作流校正。
3. **CI 覆蓋率量化**：跑 jacoco 把覆蓋率數字落地到 README badge，目前是估計值（核心 `DetectionService` 含整合測試覆蓋良好，但沒精確數字）。
