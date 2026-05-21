package io.taiwords.api.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.taiwords.api.domain.Category;
import io.taiwords.api.domain.Term;
import io.taiwords.api.domain.TermType;
import io.taiwords.api.repository.CategoryRepository;
import io.taiwords.api.repository.TermRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

/**
 * 啟動時把 classpath:seed/*.yaml 載入資料庫。
 *
 * 設計取捨：
 *   - 不用 Flyway SQL insert，因為詞庫是會頻繁變動的「資料」而非「schema」
 *   - 用「upsert by slug」做 idempotent：重複啟動不會炸
 *   - 失敗時記 error log 但不阻擋啟動（讓 healthz 還能回應，方便診斷）
 */
@Component
public class SeedLoader {

    private static final Logger log = LoggerFactory.getLogger(SeedLoader.class);

    private final CategoryRepository categoryRepository;
    private final TermRepository termRepository;
    private final boolean enabled;
    private final String seedPath;
    private final ObjectMapper yamlMapper = new YAMLMapper();

    public SeedLoader(
            CategoryRepository categoryRepository,
            TermRepository termRepository,
            @Value("${taiwords.seed.enabled:true}") boolean enabled,
            @Value("${taiwords.seed.path:classpath:seed/}") String seedPath) {
        this.categoryRepository = categoryRepository;
        this.termRepository = termRepository;
        this.enabled = enabled;
        this.seedPath = seedPath;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void loadSeeds() {
        if (!enabled) {
            log.info("SeedLoader disabled by config");
            return;
        }

        try {
            int categoryCount = loadCategories();
            int termCount = loadTerms();
            log.info("Seed load complete: {} categories, {} terms", categoryCount, termCount);
        } catch (Exception e) {
            log.error("Seed load failed — service will run with empty/existing data", e);
        }
    }

    private int loadCategories() throws IOException {
        var resolver = new PathMatchingResourcePatternResolver();
        Resource[] resources = resolver.getResources(seedPath + "categories.yaml");
        int count = 0;
        for (Resource r : resources) {
            try (var in = r.getInputStream()) {
                var file = yamlMapper.readValue(in, SeedFiles.CategoriesFile.class);
                if (file.categories() == null) continue;
                for (var seed : file.categories()) {
                    var existing = categoryRepository.findBySlug(seed.slug()).orElse(null);
                    if (existing == null) {
                        categoryRepository.save(new Category(seed.slug(), seed.nameZhTw(), seed.description()));
                    } else {
                        existing.setNameZhTw(seed.nameZhTw());
                        existing.setDescription(seed.description());
                    }
                    count++;
                }
            }
        }
        return count;
    }

    private int loadTerms() throws IOException {
        var resolver = new PathMatchingResourcePatternResolver();
        Resource[] resources = resolver.getResources(seedPath + "terms.yaml");

        // 預先載入所有 category，建立 slug → entity 的對照表，避免每筆 term 都查 DB
        Map<String, Category> categoryBySlug = new HashMap<>();
        categoryRepository.findAll().forEach(c -> categoryBySlug.put(c.getSlug(), c));

        int count = 0;
        for (Resource r : resources) {
            try (var in = r.getInputStream()) {
                var file = yamlMapper.readValue(in, SeedFiles.TermsFile.class);
                if (file.terms() == null) continue;
                for (var seed : file.terms()) {
                    if (seed.slug() == null || seed.canonicalZhTw() == null || seed.canonicalZhCn() == null) {
                        log.warn("Skip term with missing required fields: {}", seed.slug());
                        continue;
                    }
                    upsertTerm(seed, categoryBySlug);
                    count++;
                }
            }
        }
        return count;
    }

    private void upsertTerm(SeedFiles.TermSeed seed, Map<String, Category> categoryBySlug) {
        Term term = termRepository.findBySlug(seed.slug()).orElseGet(() -> new Term(
                seed.slug(),
                seed.canonicalZhTw(),
                seed.canonicalZhCn(),
                TermType.fromDb(seed.type()),
                seed.confidence() != null ? seed.confidence() : 0.5f,
                Boolean.TRUE.equals(seed.contextRequired())
        ));

        term.setCanonicalZhTw(seed.canonicalZhTw());
        term.setCanonicalZhCn(seed.canonicalZhCn());
        term.setCanonicalZhHk(seed.canonicalZhHk());
        term.setType(TermType.fromDb(seed.type()));
        term.setConfidence(seed.confidence() != null ? seed.confidence() : 0.5f);
        term.setContextRequired(Boolean.TRUE.equals(seed.contextRequired()));
        term.setNotes(seed.notes());

        // 類別重新綁定
        var newCategories = new HashSet<Category>();
        if (seed.categories() != null) {
            for (var slug : seed.categories()) {
                var c = categoryBySlug.get(slug);
                if (c != null) newCategories.add(c);
                else log.warn("Term {} references unknown category slug: {}", seed.slug(), slug);
            }
        }
        term.setCategories(newCategories);

        termRepository.save(term);
    }
}
