package io.taiwords.api.api.dto;

import io.taiwords.api.domain.Term;

import java.util.List;
import java.util.UUID;

public record TermDto(
        UUID id,
        String slug,
        String canonicalZhTw,
        String canonicalZhCn,
        String canonicalZhHk,
        String type,
        Float confidence,
        Boolean contextRequired,
        String notes,
        String reviewStatus,
        List<String> categories
) {
    public static TermDto from(Term t) {
        return new TermDto(
                t.getId(),
                t.getSlug(),
                t.getCanonicalZhTw(),
                t.getCanonicalZhCn(),
                t.getCanonicalZhHk(),
                t.getType().getDbValue(),
                t.getConfidence(),
                t.getContextRequired(),
                t.getNotes(),
                t.getReviewStatus().getDbValue(),
                t.getCategories().stream().map(c -> c.getSlug()).toList()
        );
    }
}
