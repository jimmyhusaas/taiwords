package io.taiwords.api.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DetectRequest(
        @NotBlank
        @Size(max = 10_000, message = "text 不可超過 10,000 字")
        String text,

        DetectOptions options
) {
    public DetectOptions optionsOrDefault() {
        return options == null ? new DetectOptions(0.5f) : options;
    }

    public record DetectOptions(Float minConfidence) {}
}
