-- TaiWords V1: 初始 schema
-- 詳細設計理由見 docs/02-data-schema.md
--
-- 設計取捨：
-- 用 TEXT + CHECK 而非 PostgreSQL ENUM，原因：
--   1. JPA @Enumerated(EnumType.STRING) 直接對應 TEXT 最簡單
--   2. 之後要新增 enum 值不用做 schema migration 中的 ALTER TYPE 鎖表
--   3. CHECK constraint 仍能保證資料完整性

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- 用於 gen_random_uuid()

-- ─── categories ─────────────────────────────────────────
CREATE TABLE categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT UNIQUE NOT NULL,
    name_zh_tw   TEXT NOT NULL,
    description  TEXT,
    parent_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ─── sources ────────────────────────────────────────────
CREATE TABLE sources (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    url          TEXT,
    license      TEXT,
    type         TEXT NOT NULL CHECK (type IN ('dataset', 'wiki', 'community', 'manual')),
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── terms ──────────────────────────────────────────────
CREATE TABLE terms (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              TEXT UNIQUE NOT NULL,
    canonical_zh_tw   TEXT NOT NULL,
    canonical_zh_cn   TEXT NOT NULL,
    canonical_zh_hk   TEXT,
    type              TEXT NOT NULL CHECK (type IN (
                          'same_meaning_diff_name',
                          'same_name_diff_meaning',
                          'tw_only',
                          'cn_only'
                      )),
    confidence        REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    context_required  BOOLEAN NOT NULL DEFAULT FALSE,
    examples_json     JSONB,
    aliases_json      JSONB,
    notes             TEXT,
    review_status     TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN (
                          'draft', 'pending_review', 'approved', 'disputed'
                      )),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_terms_zh_cn ON terms(canonical_zh_cn);
CREATE INDEX idx_terms_zh_tw ON terms(canonical_zh_tw);
CREATE INDEX idx_terms_status ON terms(review_status);
CREATE INDEX idx_terms_type ON terms(type);

-- 全文搜尋（簡單版，之後可換 zh-segmentation extension）
CREATE INDEX idx_terms_fts ON terms
    USING GIN (to_tsvector('simple', canonical_zh_cn || ' ' || canonical_zh_tw));

-- ─── junction: term ↔ category ──────────────────────────
CREATE TABLE term_categories (
    term_id     UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (term_id, category_id)
);

CREATE INDEX idx_term_categories_category ON term_categories(category_id);

-- ─── junction: term ↔ source ────────────────────────────
CREATE TABLE term_sources (
    term_id   UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    PRIMARY KEY (term_id, source_id)
);

-- ─── updated_at 自動更新 trigger ───────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER terms_set_updated_at
    BEFORE UPDATE ON terms
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
