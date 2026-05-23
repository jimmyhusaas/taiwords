package io.taiwords.api;

import io.taiwords.api.api.dto.DetectResponse;
import io.taiwords.api.repository.CategoryRepository;
import io.taiwords.api.repository.TermRepository;
import io.taiwords.api.service.DetectionService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end 整合測試：真實 PostgreSQL 17 (EmbeddedPostgres) + Flyway migration +
 * SeedLoader 載入完整 YAML，然後對 DetectionService 跑真實 200 條詞庫的偵測查詢。
 *
 * 與 DetectionServiceTest（mock TermRepository 的 unit test）的差異：
 * 這層驗證 schema migration、AttributeConverter、SeedLoader upsert、JPA 查詢、
 * OpenCC 字符繁化、與詞庫資料本身的一致性，整條鏈路活著才能過。
 *
 * 為什麼用 EmbeddedPostgres 而非 Testcontainers：在較新版本的 dockerd 上 testcontainers
 * 內含的 docker-java client API 版本太舊會被拒；且 EmbeddedPostgres 完全不需要 docker，
 * 開發機只要 Java 21 就能跑，CI 也不必 provision service postgres。
 *
 * 預設關閉：用 -Dintegration.test=true 啟用。Embedded PG 啟動約 3–5 秒，跟 unit test
 * 分開避免影響日常 ./gradlew test 速度。
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "integration.test", matches = "true")
class DetectionIntegrationTest {

    private static volatile EmbeddedPostgres PG;

    private static EmbeddedPostgres pg() {
        if (PG == null) {
            synchronized (DetectionIntegrationTest.class) {
                if (PG == null) {
                    try {
                        PG = EmbeddedPostgres.builder().start();
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }
            }
        }
        return PG;
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> pg().getJdbcUrl("postgres", "postgres"));
        r.add("spring.datasource.username", () -> "postgres");
        r.add("spring.datasource.password", () -> "postgres");
    }

    @AfterAll
    static void stopPg() throws IOException {
        if (PG != null) {
            PG.close();
            PG = null;
        }
    }

    @Autowired DetectionService detectionService;
    @Autowired TermRepository termRepository;
    @Autowired CategoryRepository categoryRepository;

    @Test
    void seed_loader_populates_full_corpus_and_categories() {
        assertThat(termRepository.count()).isGreaterThanOrEqualTo(200L);
        assertThat(categoryRepository.count()).isGreaterThanOrEqualTo(10L);
    }

    @Test
    void detects_readme_example_traditional() {
        DetectResponse r = detectionService.detect("這個視頻的高清畫質很給力", null);

        assertThat(r.matches()).extracting(DetectResponse.Match::slug)
                .contains("video-shipin", "high-definition", "awesome-geili");
    }

    @Test
    void detects_it_terms_mixed_traditional_and_simplified() {
        DetectResponse r = detectionService.detect(
                "登錄账号後請按鼠標右鍵，把文件存到U盘", null);

        assertThat(r.matches()).extracting(DetectResponse.Match::slug)
                .contains("account-zhanghao", "mouse-shubiao", "file-wenjian", "usb-stick-upan");
    }

    @Test
    void detects_chinese_internet_buzzwords_in_traditional() {
        DetectResponse r = detectionService.detect(
                "在小紅書種草網紅，抖音直播帶貨，朋友圈內捲躺平", 0.5f);

        assertThat(r.matches()).extracting(DetectResponse.Match::slug)
                .contains("xiaohongshu", "zhongcao", "douyin",
                        "live-commerce-daihuo",
                        "involution-neijuan", "lying-flat-tangping");
    }

    @Test
    void same_name_diff_meaning_is_matched_and_flagged_by_type() {
        DetectResponse r = detectionService.detect("我喜歡吃土豆絲", null);

        var tudou = r.matches().stream()
                .filter(m -> "potato-tudou".equals(m.slug()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("expected potato-tudou match"));
        assertThat(tudou.type()).isEqualTo("same_name_diff_meaning");
        assertThat(tudou.matchedText()).isEqualTo("土豆");
    }

    @Test
    void pure_taiwan_text_yields_no_matches() {
        // 全是台灣慣用詞：「按讚」「分享」「影片」「高畫質」「厲害」都不該匹配。
        // 即便 dianzan 的 zh_cn 是「点赞」，t2s「按讚」→「按赞」也不會誤命中。
        DetectResponse r = detectionService.detect(
                "這個影片的高畫質很厲害，朋友都按讚分享", null);

        assertThat(r.matches()).isEmpty();
    }

    @Test
    void longer_term_wins_in_real_corpus() {
        // 詞庫有 laptop-bijiben (笔记本电脑, 5 字)；台灣繁體輸入「筆記本電腦」
        // 應該被 t2s 簡化後命中這條長詞，而不是任何更短的詞。
        DetectResponse r = detectionService.detect("買了一台筆記本電腦", null);

        var match = r.matches().stream()
                .filter(m -> "laptop-bijiben".equals(m.slug()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("expected laptop-bijiben match"));
        assertThat(match.matchedText()).isEqualTo("筆記本電腦");
    }
}
