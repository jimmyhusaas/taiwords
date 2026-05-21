package io.taiwords.api.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "name_zh_tw", nullable = false)
    private String nameZhTw;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "parent_id", columnDefinition = "uuid")
    private UUID parentId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected Category() {}

    public Category(String slug, String nameZhTw, String description) {
        this.slug = slug;
        this.nameZhTw = nameZhTw;
        this.description = description;
    }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public String getNameZhTw() { return nameZhTw; }
    public String getDescription() { return description; }
    public UUID getParentId() { return parentId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setNameZhTw(String nameZhTw) { this.nameZhTw = nameZhTw; }
    public void setDescription(String description) { this.description = description; }
    public void setParentId(UUID parentId) { this.parentId = parentId; }
}
