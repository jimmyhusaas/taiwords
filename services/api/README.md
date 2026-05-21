# taiwords-api

TaiWords 後端 API — Java 21 + Spring Boot 3.3 + PostgreSQL 17 + Flyway。

## 目錄結構

```
services/api/
├── build.gradle.kts             # Gradle Kotlin DSL build script
├── settings.gradle.kts
├── Dockerfile                   # multi-stage build → JRE 21 runtime
├── src/
│   ├── main/
│   │   ├── java/io/taiwords/api/
│   │   │   ├── TaiwordsApiApplication.java
│   │   │   ├── api/             # @RestController + DTO
│   │   │   ├── domain/          # JPA entity + enum + AttributeConverter
│   │   │   ├── repository/      # Spring Data JPA
│   │   │   ├── service/         # DetectionService（偵測核心）
│   │   │   └── seed/            # 啟動時載入 YAML 詞庫
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           └── V1__init_schema.sql
│   └── test/
└── README.md
```

## 本地開發

### 方式 1：Docker Compose（推薦，零環境依賴）

```bash
# 從 repo 根目錄
docker compose up -d

# 驗證
curl http://localhost:8080/api/v1/healthz
curl http://localhost:8080/api/v1/terms
```

### 方式 2：本機 JDK + Postgres

```bash
# 1. 起 Postgres
docker run -d --name taiwords-pg \
  -e POSTGRES_DB=taiwords \
  -e POSTGRES_USER=taiwords \
  -e POSTGRES_PASSWORD=taiwords \
  -p 5432:5432 postgres:17-alpine

# 2. 啟動 API（用 Gradle wrapper）
cd services/api
./gradlew bootRun
```

## API 端點

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/v1/healthz` | 健康檢查（自家簡化版） |
| GET | `/actuator/health` | Spring Actuator 完整健康狀態 |
| GET | `/api/v1/terms?keyword=&page=&size=` | 詞條列表（支援關鍵字搜尋與分頁） |
| GET | `/api/v1/terms/{slug}` | 單一詞條詳情 |
| GET | `/api/v1/categories` | 分類清單 |
| POST | `/api/v1/detect` | 偵測一段文字中的支語 |
| GET | `/swagger-ui.html` | 互動式 API 文件 |

### POST /api/v1/detect 範例

```bash
curl -X POST http://localhost:8080/api/v1/detect \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "這個視頻的高清畫質很給力",
    "options": { "minConfidence": 0.5 }
  }'
```

Response：
```jsonc
{
  "text": "這個視頻的高清畫質很給力",
  "matches": [
    {
      "termId": "01HABCD...",
      "slug": "video-shipin",
      "matchedText": "視頻",
      "start": 2,
      "end": 4,
      "suggestedZhTw": "影片",
      "confidence": 0.95,
      "type": "same_meaning_diff_name",
      "note": "中國大陸用語..."
    }
    // ... 高清、給力
  ],
  "stats": {
    "charCount": 13,
    "matchCount": 3,
    "alertRatio": 0.46
  }
}
```

## 環境變數

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `TAIWORDS_DB_URL` | `jdbc:postgresql://localhost:5432/taiwords` | DB 連線字串 |
| `TAIWORDS_DB_USER` | `taiwords` | DB 帳號 |
| `TAIWORDS_DB_PASSWORD` | `taiwords` | DB 密碼 |
| `TAIWORDS_SEED_ENABLED` | `true` | 啟動時是否載入 YAML 詞庫 |
| `TAIWORDS_LOG_LEVEL` | `INFO` | `io.taiwords` 套件的 log level |
| `PORT` | `8080` | Server port |

## 詞庫資料

- **canonical YAML** 位於 repo 根 `data/seed/{categories,terms}.yaml`
- Gradle build 時複製到 `build/resources/main/seed/`，跟 jar 一起打包
- 啟動時由 `SeedLoader` 讀取並 upsert 到 DB（idempotent，重啟不會炸）
- 想關掉自動載入：`TAIWORDS_SEED_ENABLED=false`

## 測試

```bash
./gradlew test         # smoke test（H2 in-memory）
./gradlew build        # build + 全部 test + 產出 jar
```

> 完整整合測試（含 Testcontainers + 真實 PostgreSQL）會在 Phase 1 後段補上。

## 技術決策摘要

| 決策 | 為什麼 |
| --- | --- |
| Gradle Kotlin DSL | 型別安全、現代化、與 Spring Boot 官方範例對齊 |
| Flyway 管 schema、JPA 只 validate | 「資料庫變更走 SQL migration」是業界主流；避免 `ddl-auto=update` 的失控 |
| 詞庫走 YAML + SeedLoader 而非 SQL insert | 詞庫是「資料」不是「schema」；YAML 對非工程貢獻者更友善 |
| 偵測 Phase 1 用字串掃描 | 詞量小（< 1k）時夠用；Phase 4 升級成 Aho-Corasick + NLP service |
| AttributeConverter 處理 enum | DB 維持 snake_case，Java enum 維持 UPPER_CASE，互不污染 |
