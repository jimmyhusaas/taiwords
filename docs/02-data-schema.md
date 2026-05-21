# 圖鑑資料 Schema 設計

## 1. 設計原則

1. **同實異名 vs 同名異實 必須清楚分開**
   - 「視頻 ↔ 影片」屬於同實異名（一對一替換多半安全）
   - 「窩心」在台灣指「貼心」、在中國指「心裡不舒服」——同名異實，**不能無腦替換**
2. **每個詞條都要可追溯來源** — 用於 fact-check 與授權
3. **信心度欄位** — 不是所有詞都 100% 是支語，需要分級
4. **可擴充至港、星馬等其他華語地區**（即使 MVP 不做，schema 不要鎖死）
5. **支援雙向查詢** — 既要能查「視頻是不是支語」，也要能查「影片在中國叫什麼」

---

## 2. 核心實體（Entity）

### 2.1 `term`（詞條）

```yaml
id: uuid                       # 內部 ID
slug: kebab-case-string        # URL 友善的識別字，例如 "video-shipin"
canonical_zh_tw: string        # 台灣慣用詞（必填）
canonical_zh_cn: string        # 中國慣用詞（必填）
canonical_zh_hk: string?       # 香港用詞（可選）
type: enum                     # 詞條類型：同實異名 / 同名異實
  - "same_meaning_diff_name"   # 視頻 vs 影片
  - "same_name_diff_meaning"   # 窩心、土豆
  - "tw_only"                  # 台灣特有（如：機車、宅）
  - "cn_only"                  # 中國特有（如：城管、戶口）
category_ids: [uuid]           # 多分類（IT、生活、體育...）
confidence: float (0.0–1.0)    # 是支語的信心度
                               #   1.0 = 公認支語（視頻、質量、信息）
                               #   0.7 = 多數情境是（高清、給力）
                               #   0.4 = 兩岸通用但中國較常用（軟件、優化）
                               #   0.2 = 中性詞，僅供參考
context_required: bool         # true = 需要看上下文才能判斷（同名異實必為 true）
examples:                      # 例句
  - text: "這個視頻很好看"
    region: "cn"
  - text: "這個影片很好看"
    region: "tw"
notes: markdown                # 補充說明（語源、爭議）
aliases:                       # 別名/變體
  zh_tw: ["短片", "影音"]
  zh_cn: ["小视频"]
sources: [uuid]                # 對應 source 表
created_at: timestamp
updated_at: timestamp
review_status: enum            # draft / pending_review / approved / disputed
```

### 2.2 `category`（分類）

```yaml
id: uuid
slug: string                   # "it", "daily-life", "sports", "food"
name_zh_tw: string             # 「資訊」、「生活」
description: markdown
parent_id: uuid?               # 支援階層分類
```

**MVP 的分類（提案）：**
- `it` — 資訊／軟體／網路
- `daily-life` — 日常生活
- `food` — 飲食
- `transport` — 交通
- `media` — 影視娛樂
- `business` — 商業／金融
- `internet-slang` — 網路流行語
- `politics` — 政治／制度（敏感，需特別審核）
- `academic` — 學術／教育

### 2.3 `source`（來源）

```yaml
id: uuid
name: string                   # "g0v moedict-data-csld"
url: string
license: string                # "CC-BY-SA-4.0"
type: enum                     # dataset / wiki / community / manual
description: string
```

### 2.4 `revision`（版本紀錄，後期社群協作用）

```yaml
id: uuid
term_id: uuid
diff: json                     # patch 格式
author: string                 # 暱稱或 GitHub handle
reason: string
created_at: timestamp
approved: bool
```

---

## 3. PostgreSQL DDL 草稿

```sql
CREATE TYPE term_type AS ENUM (
  'same_meaning_diff_name',
  'same_name_diff_meaning',
  'tw_only',
  'cn_only'
);

CREATE TYPE review_status AS ENUM (
  'draft', 'pending_review', 'approved', 'disputed'
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name_zh_tw  TEXT NOT NULL,
  description TEXT,
  parent_id   UUID REFERENCES categories(id)
);

CREATE TABLE sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  url         TEXT,
  license     TEXT,
  type        TEXT,
  description TEXT
);

CREATE TABLE terms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  canonical_zh_tw   TEXT NOT NULL,
  canonical_zh_cn   TEXT NOT NULL,
  canonical_zh_hk   TEXT,
  type              term_type NOT NULL,
  confidence        REAL CHECK (confidence BETWEEN 0 AND 1),
  context_required  BOOLEAN DEFAULT FALSE,
  examples_json     JSONB,
  notes             TEXT,
  aliases_json      JSONB,
  review_status     review_status DEFAULT 'draft',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE term_categories (
  term_id     UUID REFERENCES terms(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, category_id)
);

CREATE TABLE term_sources (
  term_id   UUID REFERENCES terms(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, source_id)
);

-- 索引：全文搜尋與快速 lookup
CREATE INDEX idx_terms_zh_cn ON terms(canonical_zh_cn);
CREATE INDEX idx_terms_zh_tw ON terms(canonical_zh_tw);
CREATE INDEX idx_terms_status ON terms(review_status);
CREATE INDEX idx_terms_fts ON terms
  USING GIN (to_tsvector('simple', canonical_zh_cn || ' ' || canonical_zh_tw));
```

---

## 4. 偵測 API 回傳格式

```jsonc
// POST /api/v1/detect
// body: { "text": "這個視頻的高清畫質很給力", "options": { "min_confidence": 0.5 } }

{
  "text": "這個視頻的高清畫質很給力",
  "language_hint": "zh-Hant",
  "matches": [
    {
      "term_id": "01HABCD...",
      "matched_text": "視頻",
      "start": 2,
      "end": 4,
      "suggested_zh_tw": "影片",
      "confidence": 0.95,
      "category": "media",
      "type": "same_meaning_diff_name",
      "note": "中國大陸用語，建議使用「影片」"
    },
    {
      "term_id": "01HXYZW...",
      "matched_text": "高清",
      "start": 5,
      "end": 7,
      "suggested_zh_tw": "高畫質",
      "confidence": 0.85,
      "category": "media",
      "type": "same_meaning_diff_name"
    },
    {
      "term_id": "01HQQQQ...",
      "matched_text": "給力",
      "start": 11,
      "end": 13,
      "suggested_zh_tw": "厲害／到位",
      "confidence": 0.6,
      "category": "internet-slang",
      "type": "same_meaning_diff_name"
    }
  ],
  "stats": {
    "char_count": 13,
    "match_count": 3,
    "support_ratio": 0.0,
    "alert_ratio": 0.46
  }
}
```

---

## 5. 邊角案例（要在 schema 與測試中明確處理）

1. **「軟件」vs「軟體」** → confidence 應該高（0.9+），category=it
2. **「土豆」** → 同名異實（台灣=花生，中國=馬鈴薯），context_required=true
3. **「打車」** → 兩岸都用但意義略有差，需要 notes 補充
4. **「視頻」做為影片檔名一部分**（例如 `mp4_video_素材`） → 偵測器需要避免誤判技術字串
5. **作家引用對岸文獻** → 由 confidence 與使用者設定門檻處理，不在 schema 層處理
