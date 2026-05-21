package io.taiwords.api.seed;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 對應 data/seed/*.yaml 的反序列化結構。
 * 欄位名直接對應 YAML key（用 @JsonProperty 處理 snake_case）。
 */
public final class SeedFiles {

    public record CategoriesFile(List<CategorySeed> categories) {}

    public record CategorySeed(
            String slug,
            @JsonProperty("name_zh_tw") String nameZhTw,
            String description,
            @JsonProperty("parent_slug") String parentSlug
    ) {}

    public record TermsFile(List<TermSeed> terms) {}

    public record TermSeed(
            String slug,
            @JsonProperty("canonical_zh_tw") String canonicalZhTw,
            @JsonProperty("canonical_zh_cn") String canonicalZhCn,
            @JsonProperty("canonical_zh_hk") String canonicalZhHk,
            String type,
            Float confidence,
            @JsonProperty("context_required") Boolean contextRequired,
            List<String> categories,
            List<Map<String, String>> examples,
            Map<String, List<String>> aliases,
            String notes
    ) {}

    private SeedFiles() {}
}
