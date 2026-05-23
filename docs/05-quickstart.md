# 本地 Quickstart

> 從 `git pull` 到看到第一個偵測結果，目標 5 分鐘。

## 需要的工具

- **Docker Desktop** 24+（要能 `docker compose` 拉得到鏡像）
- **Java 21 SDK**（給 IDE / 本機跑 Gradle 用，可選）
- **pnpm**（給擴充套件 dev mode 用，可選）
- **curl** 或 Postman（測 API）

確認版本：
```bash
docker --version          # >= 24.0
docker compose version    # >= 2.20
```

---

## 1. 啟動 API（docker compose）

從 repo 根目錄：

```bash
docker compose up -d
```

首次會拉 `postgres:17-alpine` 與 build API image，**約 1–3 分鐘**。完成後兩個容器：

```bash
docker compose ps
# NAME                STATUS              PORTS
# taiwords-postgres   Up (healthy)        0.0.0.0:5432->5432/tcp
# taiwords-api        Up                  0.0.0.0:8080->8080/tcp
```

看一下 SeedLoader log，確認詞庫真的灌進去了：

```bash
docker compose logs api | grep "Seed load complete"
# Seed load complete: 10 categories, 200 terms
```

如果你看到 `0 categories, 0 terms` 那就是 SeedLoader 失敗——這次 push 已修，請確認你 pull 的是最新 commit。

---

## 2. 試打 API

### Health check

```bash
curl http://localhost:8080/api/v1/healthz
# {"service":"taiwords-api","status":"ok","time":"2026-05-23T08:00:00.000Z"}
```

### 列出詞條（前 20 筆）

```bash
curl 'http://localhost:8080/api/v1/terms?size=5' | jq .
```

預期：

```jsonc
{
  "content": [
    {
      "slug": "account-zhanghao",
      "canonicalZhTw": "帳號",
      "canonicalZhCn": "账号",
      "type": "same_meaning_diff_name",
      "confidence": 0.85,
      "categories": ["it"]
      // ...
    }
    // ... 共 5 筆
  ],
  "totalElements": 200,
  "totalPages": 40
}
```

### 偵測一段文字（核心 demo）

```bash
curl -X POST http://localhost:8080/api/v1/detect \
  -H 'Content-Type: application/json' \
  -d '{"text":"這個視頻的高清畫質很給力，朋友都在小紅書種草"}' | jq .
```

預期：

```jsonc
{
  "text": "這個視頻的高清畫質很給力，朋友都在小紅書種草",
  "matches": [
    {
      "slug": "video-shipin",
      "matchedText": "視頻",
      "start": 2, "end": 4,
      "suggestedZhTw": "影片",
      "confidence": 0.95,
      "type": "same_meaning_diff_name"
    },
    {
      "slug": "high-definition",
      "matchedText": "高清",
      "start": 5, "end": 7,
      "suggestedZhTw": "高畫質",
      "confidence": 0.9,
      "type": "same_meaning_diff_name"
    },
    {
      "slug": "awesome-geili",
      "matchedText": "給力",
      "start": 11, "end": 13,
      "suggestedZhTw": "厲害／到位",
      "confidence": 0.85,
      "type": "same_meaning_diff_name"
    },
    {
      "slug": "xiaohongshu",
      "matchedText": "小紅書",
      "start": 18, "end": 21,
      "suggestedZhTw": "（無對應，中國社群電商）",
      "confidence": 1.0,
      "type": "cn_only"
    },
    {
      "slug": "zhongcao",
      "matchedText": "種草",
      "start": 21, "end": 23,
      "suggestedZhTw": "推坑",
      "confidence": 0.9,
      "type": "same_meaning_diff_name"
    }
  ],
  "stats": { "charCount": 23, "matchCount": 5, "alertRatio": 0.52 }
}
```

注意 `matchedText` 保留你輸入的繁體字（「視頻」「小紅書」），不是詞庫存的簡體版本——這是 OpenCC t2s 正規化的功勞。

### 試試覆寫 confidence

```bash
# 降到 0.3 會多抓「自行車」「電視劇」「網紅」這類兩岸通用詞
curl -X POST http://localhost:8080/api/v1/detect \
  -H 'Content-Type: application/json' \
  -d '{"text":"這部電視劇好看","options":{"minConfidence":0.3}}' | jq .matches
```

### 互動式 API 文件

開瀏覽器：

```
http://localhost:8080/swagger-ui.html
```

可以在頁面直接戳 endpoint，看完整 schema。

---

## 3. 啟動 Chrome 擴充套件（可選）

另開一個 terminal：

```bash
cd apps/extension
pnpm install      # 第一次約 30 秒
pnpm dev
```

`pnpm dev` 會：
1. 跑 WXT dev server（hot-reload）
2. 自動開一個乾淨的 Chromium，並側載這個擴充套件

到任何中文網頁（PTT、Yahoo 新聞、Mobile01），右下角會有一個圓角「**台詞 ⚑**」按鈕。點下去會：
- 抓頁面前 8000 字
- POST 到 `http://localhost:8080/api/v1/detect`
- `alert()` 顯示前 12 筆偵測結果

> 若 alert 顯示「連線失敗」，多半是 API 沒起，回去確認 `docker compose ps`。

---

## 4. 跑單元 / 整合測試

```bash
cd services/api
./gradlew test                                # 14 個 unit + controller test，~3 秒
./gradlew test -Dintegration.test=true        # 加上 7 個整合測試（用 EmbeddedPostgres），總共 ~30 秒
```

35 個測試全綠，不需要外部 docker。

---

## 排錯

### `docker compose up` 卡在 build API image

通常是 Gradle dependency 下載。看 log：

```bash
docker compose logs api
```

第一次 build 會花 1–2 分鐘下載 Spring Boot、OpenCC4J 等。後續會用 cache 加速。

### `Seed load failed`

之前曾有 SeedLoader 因 `terms.yaml` 底部 inline `sources:` block 失敗的 bug。最新 commit (`d4aafad` `fix(seed): tolerate unknown YAML fields`) 已用 `@JsonIgnoreProperties` 修掉。確認你 pull 到的版本包含這條 commit：

```bash
git log --oneline | grep "fix(seed)"
```

### API 顯示 `validation` 失敗

`POST /detect` 對 text 有限制：
- `@NotBlank` — 不能是空字串
- `@Size(max = 10_000)` — 最多 1 萬字

超過會回 400。

### 擴充套件 alert 一直顯示「連線失敗」

Chrome 對 mixed content（HTTPS 頁面 fetch HTTP API）會擋。如果你在 HTTPS 網站（如 yahoo.com）測，Chrome 預設不擋 localhost，但有些設定可能影響。看 DevTools console (`F12`)：

```
[TaiWords] TypeError: Failed to fetch
```

通常就是 API 沒起或 port 8080 被別的 process 佔住。

---

## 清乾淨

```bash
docker compose down -v    # 連 PostgreSQL volume 一起砍
```
