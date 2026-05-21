package io.taiwords.api.api.dto;

import java.util.List;
import java.util.UUID;

public record DetectResponse(
        String text,
        List<Match> matches,
        Stats stats
) {
    public record Match(
            UUID termId,
            String slug,
            String matchedText,
            int start,
            int end,
            String suggestedZhTw,
            Float confidence,
            String type,
            String note
    ) {}

    public record Stats(
            int charCount,
            int matchCount,
            double alertRatio
    ) {}
}
