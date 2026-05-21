package io.taiwords.api.service;

import io.taiwords.api.api.dto.DetectResponse;
import io.taiwords.api.domain.Term;
import io.taiwords.api.repository.TermRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 偵測服務 — Phase 1 簡易版。
 *
 * 演算法：
 *   1. 從 DB 取出 confidence >= minConfidence 的詞條
 *   2. 依「中國用語長度」從長到短排序（避免「视频」蓋掉更長的「短视频」）
 *   3. 逐個用 indexOf 做字串掃描，遇到匹配就記錄並把該範圍標記為已用
 *   4. 回傳 matches + 統計
 *
 * Phase 4 會升級為 Aho-Corasick + NLP 微服務，做上下文消歧。
 */
@Service
public class DetectionService {

    private final TermRepository termRepository;
    private final float defaultMinConfidence;

    public DetectionService(
            TermRepository termRepository,
            @Value("${taiwords.detection.default-min-confidence:0.5}") float defaultMinConfidence) {
        this.termRepository = termRepository;
        this.defaultMinConfidence = defaultMinConfidence;
    }

    public DetectResponse detect(String text, Float minConfidence) {
        float threshold = minConfidence == null ? defaultMinConfidence : minConfidence;

        // 取出可用於偵測的詞條，依中國用語長度從長到短
        List<Term> terms = termRepository.findForDetection(threshold).stream()
                .filter(t -> t.getCanonicalZhCn() != null && !t.getCanonicalZhCn().isBlank())
                .sorted(Comparator.comparingInt((Term t) -> t.getCanonicalZhCn().length()).reversed())
                .toList();

        boolean[] taken = new boolean[text.length()];
        List<DetectResponse.Match> matches = new ArrayList<>();

        for (Term t : terms) {
            String needle = t.getCanonicalZhCn();
            int from = 0;
            while (from <= text.length() - needle.length()) {
                int idx = text.indexOf(needle, from);
                if (idx < 0) break;

                // 檢查這個範圍是否已被更長的詞佔走
                if (!isRangeFree(taken, idx, idx + needle.length())) {
                    from = idx + 1;
                    continue;
                }
                markTaken(taken, idx, idx + needle.length());

                matches.add(new DetectResponse.Match(
                        t.getId(),
                        t.getSlug(),
                        needle,
                        idx,
                        idx + needle.length(),
                        t.getCanonicalZhTw(),
                        t.getConfidence(),
                        t.getType().getDbValue(),
                        t.getNotes()
                ));
                from = idx + needle.length();
            }
        }

        // 依出現位置排序
        matches.sort(Comparator.comparingInt(DetectResponse.Match::start));

        int charCount = text.length();
        double alertRatio = charCount == 0
                ? 0.0
                : matches.stream().mapToInt(m -> m.end() - m.start()).sum() / (double) charCount;

        return new DetectResponse(text, matches, new DetectResponse.Stats(charCount, matches.size(), alertRatio));
    }

    private static boolean isRangeFree(boolean[] taken, int start, int end) {
        for (int i = start; i < end; i++) {
            if (taken[i]) return false;
        }
        return true;
    }

    private static void markTaken(boolean[] taken, int start, int end) {
        for (int i = start; i < end; i++) {
            taken[i] = true;
        }
    }
}
