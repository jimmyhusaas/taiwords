package io.taiwords.api.domain;

/**
 * 詞條審核狀態。draft 為預設，正式上線需 approved。
 */
public enum ReviewStatus {
    DRAFT("draft"),
    PENDING_REVIEW("pending_review"),
    APPROVED("approved"),
    DISPUTED("disputed");

    private final String dbValue;

    ReviewStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String getDbValue() {
        return dbValue;
    }

    public static ReviewStatus fromDb(String value) {
        for (var s : values()) {
            if (s.dbValue.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown review status: " + value);
    }
}
