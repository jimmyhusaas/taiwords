package io.taiwords.api.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "terms")
public class Term {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "canonical_zh_tw", nullable = false)
    private String canonicalZhTw;

    @Column(name = "canonical_zh_cn", nullable = false)
    private String canonicalZhCn;

    @Column(name = "canonical_zh_hk")
    private String canonicalZhHk;

    @Column(nullable = false, columnDefinition = "text")
    private TermType type;

    @Column(nullable = false)
    private Float confidence;

    @Column(name = "context_required", nullable = false)
    private Boolean contextRequired = false;

    /** JSON 結構：[{ "text": "...", "region": "tw|cn" }] */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "examples_json", columnDefinition = "jsonb")
    private String examplesJson;

    /** JSON 結構：{ "zh_tw": [...], "zh_cn": [...] } */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "aliases_json", columnDefinition = "jsonb")
    private String aliasesJson;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "review_status", nullable = false, columnDefinition = "text")
    private ReviewStatus reviewStatus = ReviewStatus.DRAFT;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "term_categories",
        joinColumns = @JoinColumn(name = "term_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private Set<Category> categories = new HashSet<>();

    protected Term() {}

    public Term(String slug, String canonicalZhTw, String canonicalZhCn,
                TermType type, Float confidence, Boolean contextRequired) {
        this.slug = slug;
        this.canonicalZhTw = canonicalZhTw;
        this.canonicalZhCn = canonicalZhCn;
        this.type = type;
        this.confidence = confidence;
        this.contextRequired = contextRequired;
    }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public String getCanonicalZhTw() { return canonicalZhTw; }
    public String getCanonicalZhCn() { return canonicalZhCn; }
    public String getCanonicalZhHk() { return canonicalZhHk; }
    public TermType getType() { return type; }
    public Float getConfidence() { return confidence; }
    public Boolean getContextRequired() { return contextRequired; }
    public String getExamplesJson() { return examplesJson; }
    public String getAliasesJson() { return aliasesJson; }
    public String getNotes() { return notes; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Set<Category> getCategories() { return categories; }

    public void setCanonicalZhTw(String v) { this.canonicalZhTw = v; }
    public void setCanonicalZhCn(String v) { this.canonicalZhCn = v; }
    public void setCanonicalZhHk(String v) { this.canonicalZhHk = v; }
    public void setType(TermType v) { this.type = v; }
    public void setConfidence(Float v) { this.confidence = v; }
    public void setContextRequired(Boolean v) { this.contextRequired = v; }
    public void setExamplesJson(String v) { this.examplesJson = v; }
    public void setAliasesJson(String v) { this.aliasesJson = v; }
    public void setNotes(String v) { this.notes = v; }
    public void setReviewStatus(ReviewStatus v) { this.reviewStatus = v; }
    public void setCategories(Set<Category> v) { this.categories = v; }
}
