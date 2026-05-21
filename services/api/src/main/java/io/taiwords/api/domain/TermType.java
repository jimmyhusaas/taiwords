package io.taiwords.api.domain;

/**
 * 詞條類型 — 描述兩岸對照詞的語義關係。
 * 設計理由見 docs/02-data-schema.md §1。
 */
public enum TermType {
    /** 同實異名：視頻 vs 影片（一對一替換多半安全） */
    SAME_MEANING_DIFF_NAME("same_meaning_diff_name"),

    /** 同名異實：土豆 / 窩心（必須看上下文） */
    SAME_NAME_DIFF_MEANING("same_name_diff_meaning"),

    /** 台灣特有，無對應中國用語（如：捷運、機車口語意） */
    TW_ONLY("tw_only"),

    /** 中國特有，無對應台灣用語（如：城管、戶口） */
    CN_ONLY("cn_only");

    private final String dbValue;

    TermType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String getDbValue() {
        return dbValue;
    }

    public static TermType fromDb(String value) {
        for (var t : values()) {
            if (t.dbValue.equals(value)) return t;
        }
        throw new IllegalArgumentException("Unknown term type: " + value);
    }
}
