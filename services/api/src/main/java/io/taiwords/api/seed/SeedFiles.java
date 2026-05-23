package io.taiwords.api.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 對應 data/seed/*.yaml 的反序列化結構。
 * 欄位名直接對應 YAML key（用 @JsonProperty 處理 snake_case）。
 *
 * 用 @JsonIgnoreProperties(ignoreUnknown=true) 容忍 YAML 內未來新增的欄位 ——
 * terms.yaml 目前底部還掛了一段 inline `sources:` block（roadmap 預留將來分離到
 * sources.yaml），不加這個 annotation 整個 YAML 會解析失敗，SeedLoader 默默吞
 * exception 後只 log，結果 DB 一條都沒灌進去，外部完全看不出來。
 */
public final class SeedFiles {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CategoriesFile(List<CategorySeed> categories) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CategorySeed(
            String slug,
            @JsonProperty("name_zh_tw") String nameZhTw,
            String description,
            @JsonProperty("parent_slug") String parentSlug
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TermsFile(List<TermSeed> terms) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
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
