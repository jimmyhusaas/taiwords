package io.taiwords.api.service;

import io.taiwords.api.api.dto.DetectResponse;
import io.taiwords.api.domain.Term;
import io.taiwords.api.domain.TermType;
import io.taiwords.api.repository.TermRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyFloat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DetectionServiceTest {

    private TermRepository repo;
    private DetectionService service;

    @BeforeEach
    void setUp() {
        repo = mock(TermRepository.class);
        service = new DetectionService(repo, 0.5f);
    }

    private static Term term(String slug, String zhTw, String zhCn, float confidence) {
        return term(slug, zhTw, zhCn, confidence, TermType.SAME_MEANING_DIFF_NAME);
    }

    private static Term term(String slug, String zhTw, String zhCn, float confidence, TermType type) {
        return new Term(slug, zhTw, zhCn, type, confidence, false);
    }

    private void seed(Term... terms) {
        when(repo.findForDetection(anyFloat())).thenReturn(List.of(terms));
    }

    // ─── 基本 happy path ─────────────────────────────────────

    @Test
    void detects_simplified_input() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        DetectResponse r = service.detect("这个视频好看", null);

        assertThat(r.matches()).hasSize(1);
        DetectResponse.Match m = r.matches().get(0);
        assertThat(m.matchedText()).isEqualTo("视频");
        assertThat(m.suggestedZhTw()).isEqualTo("影片");
        assertThat(m.start()).isEqualTo(2);
        assertThat(m.end()).isEqualTo(4);
    }

    @Test
    void detects_traditional_input_via_s2t_expansion() {
        // 核心：詞庫存簡體「视频」，但使用者輸入繁體「視頻」也要命中
        seed(term("video-shipin", "影片", "视频", 0.95f));

        DetectResponse r = service.detect("這個視頻好看", null);

        assertThat(r.matches()).hasSize(1);
        DetectResponse.Match m = r.matches().get(0);
        assertThat(m.matchedText()).isEqualTo("視頻");   // 保留實際命中的字面
        assertThat(m.suggestedZhTw()).isEqualTo("影片");
    }

    @Test
    void detects_traditional_for_multi_char_terms() {
        seed(
                term("involution", "（無精準對應）", "内卷", 0.95f, TermType.CN_ONLY),
                term("net-celeb", "網紅", "网红", 0.9f),
                term("dianzan", "按讚", "点赞", 0.95f)
        );

        DetectResponse r = service.detect("這個網紅天天叫人點讚還在抱怨內卷", null);

        assertThat(r.matches()).extracting(DetectResponse.Match::matchedText)
                .containsExactly("網紅", "點讚", "內卷");
    }

    // ─── 長詞優先（roadmap 強調的「避免短詞蓋掉長詞」） ─────────

    @Test
    void longer_term_wins_over_shorter_overlap() {
        seed(
                term("video", "影片", "视频", 0.95f),
                term("short-video", "短影片", "短视频", 0.9f)
        );

        DetectResponse r = service.detect("我喜歡看短视频", null);

        assertThat(r.matches()).hasSize(1);
        assertThat(r.matches().get(0).matchedText()).isEqualTo("短视频");
        assertThat(r.matches().get(0).suggestedZhTw()).isEqualTo("短影片");
    }

    @Test
    void longer_term_wins_for_traditional_input_too() {
        seed(
                term("video", "影片", "视频", 0.95f),
                term("short-video", "短影片", "短视频", 0.9f)
        );

        DetectResponse r = service.detect("我喜歡看短視頻", null);

        assertThat(r.matches()).hasSize(1);
        assertThat(r.matches().get(0).matchedText()).isEqualTo("短視頻");
        assertThat(r.matches().get(0).suggestedZhTw()).isEqualTo("短影片");
    }

    // ─── 重複命中與順序 ─────────────────────────────────────

    @Test
    void same_term_matches_multiple_times_sorted_by_position() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        DetectResponse r = service.detect("视频很多，這個視頻也好看", null);

        assertThat(r.matches()).hasSize(2);
        assertThat(r.matches().get(0).start()).isLessThan(r.matches().get(1).start());
        assertThat(r.matches().get(0).matchedText()).isEqualTo("视频");
        assertThat(r.matches().get(1).matchedText()).isEqualTo("視頻");
    }

    // ─── 邊界 ──────────────────────────────────────────────

    @Test
    void empty_text_returns_no_matches() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        DetectResponse r = service.detect("", null);

        assertThat(r.matches()).isEmpty();
        assertThat(r.stats().charCount()).isZero();
        assertThat(r.stats().alertRatio()).isZero();
    }

    @Test
    void no_matches_when_text_is_pure_taiwan_usage() {
        seed(
                term("video-shipin", "影片", "视频", 0.95f),
                term("net-celeb", "網紅", "网红", 0.9f)
        );

        DetectResponse r = service.detect("這個影片的畫質很好", null);

        assertThat(r.matches()).isEmpty();
    }

    @Test
    void empty_candidate_terms_means_no_matches() {
        when(repo.findForDetection(anyFloat())).thenReturn(List.of());

        DetectResponse r = service.detect("這個視頻很給力", null);

        assertThat(r.matches()).isEmpty();
    }

    // ─── stats 計算 ───────────────────────────────────────

    @Test
    void alert_ratio_reflects_matched_char_share() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        DetectResponse r = service.detect("视频", null);

        assertThat(r.stats().charCount()).isEqualTo(2);
        assertThat(r.stats().matchCount()).isEqualTo(1);
        assertThat(r.stats().alertRatio()).isEqualTo(1.0);
    }

    // ─── min_confidence override ─────────────────────────

    @Test
    void custom_min_confidence_is_forwarded_to_repository() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        service.detect("视频", 0.8f);

        org.mockito.Mockito.verify(repo).findForDetection(0.8f);
    }

    @Test
    void default_min_confidence_used_when_null() {
        seed(term("video-shipin", "影片", "视频", 0.95f));

        service.detect("视频", null);

        org.mockito.Mockito.verify(repo).findForDetection(0.5f);
    }

    // ─── 同名異實（context_required，但目前算法仍會命中，靠 type 標示） ─

    @Test
    void same_name_diff_meaning_term_still_matches_and_marks_type() {
        seed(term("potato-tudou", "馬鈴薯", "土豆", 0.95f, TermType.SAME_NAME_DIFF_MEANING));

        DetectResponse r = service.detect("土豆沙拉", null);

        assertThat(r.matches()).hasSize(1);
        assertThat(r.matches().get(0).type()).isEqualTo("same_name_diff_meaning");
    }
}
