package io.taiwords.api.service;

import com.github.houbb.opencc4j.util.ZhConverterUtil;
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
 *   2. 把輸入文字逐字繁→簡（OpenCC4J t2s），得到 simpleText 與原文等長
 *      ※ 為什麼朝簡化方向：繁→簡幾乎一對一（穩定），簡→繁有歧義
 *        （如「点赞」可繁化為「點贊」或「點讚」），會 miss 使用者實際寫法
 *   3. 詞庫 canonical_zh_cn（簡體）依長度從長到短排序，在 simpleText 上掃
 *      （避免「视频」蓋掉更長的「短视频」）
 *   4. 命中後 matchedText 從原文取 substring，保留使用者實際寫的字面
 *   5. 回傳 matches + 統計
 *
 * 為什麼需要這層繁簡正規化：詞庫存簡體（canonical_zh_cn），但台灣使用者多半輸入
 * 繁體寫的支語（「視頻／網紅／點讚／內捲」），少了這層 miss 率會極高。
 *
 * Phase 4 會升級為 Aho-Corasick + NLP 微服務，做上下文消歧。
 */
@Service
public class DetectionService {

    private final TermRepository termRepository;
    private final float defaultMinConfidence;

    public DetectionService(
            TermRepository termRepository,
            @Value("${taiwords.detection.default-min-confidence:0.7}") float defaultMinConfidence) {
        this.termRepository = termRepository;
        this.defaultMinConfidence = defaultMinConfidence;
    }

    public DetectResponse detect(String text, Float minConfidence) {
        float threshold = minConfidence == null ? defaultMinConfidence : minConfidence;

        String simpleText = normalizeToSimplified(text);

        List<Term> terms = termRepository.findForDetection(threshold).stream()
                .filter(t -> t.getCanonicalZhCn() != null && !t.getCanonicalZhCn().isBlank())
                .sorted(Comparator.comparingInt((Term t) -> t.getCanonicalZhCn().length()).reversed())
                .toList();

        boolean[] taken = new boolean[text.length()];
        List<DetectResponse.Match> matches = new ArrayList<>();

        for (Term t : terms) {
            String needle = t.getCanonicalZhCn();
            int from = 0;
            while (from <= simpleText.length() - needle.length()) {
                int idx = simpleText.indexOf(needle, from);
                if (idx < 0) break;

                if (!isRangeFree(taken, idx, idx + needle.length())) {
                    from = idx + 1;
                    continue;
                }
                markTaken(taken, idx, idx + needle.length());

                matches.add(new DetectResponse.Match(
                        t.getId(),
                        t.getSlug(),
                        text.substring(idx, idx + needle.length()),
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

        matches.sort(Comparator.comparingInt(DetectResponse.Match::start));

        int charCount = text.length();
        double alertRatio = charCount == 0
                ? 0.0
                : matches.stream().mapToInt(m -> m.end() - m.start()).sum() / (double) charCount;

        return new DetectResponse(text, matches, new DetectResponse.Stats(charCount, matches.size(), alertRatio));
    }

    /**
     * 把繁體輸入轉成簡體，與原文逐字對齊（長度相同）。
     * 若 OpenCC 預設模式回傳長度與原文不一致（罕見，可能是 phrase-level 轉換），
     * 退化為逐字轉換以保證位置對齊。
     */
    private static String normalizeToSimplified(String text) {
        if (text == null || text.isEmpty()) return "";
        String s = ZhConverterUtil.toSimple(text);
        if (s.length() == text.length()) return s;
        // Fallback：逐字轉換確保位置對齊
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            String one = String.valueOf(text.charAt(i));
            String simp = ZhConverterUtil.toSimple(one);
            sb.append(simp.length() == 1 ? simp : one);
        }
        return sb.toString();
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
