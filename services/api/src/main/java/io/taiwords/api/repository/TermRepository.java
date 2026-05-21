package io.taiwords.api.repository;

import io.taiwords.api.domain.Term;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TermRepository extends JpaRepository<Term, UUID> {

    Optional<Term> findBySlug(String slug);

    @Query("""
        SELECT t FROM Term t
        WHERE (:keyword IS NULL OR
               t.canonicalZhTw LIKE %:keyword% OR
               t.canonicalZhCn LIKE %:keyword%)
        """)
    Page<Term> search(@Param("keyword") String keyword, Pageable pageable);

    /**
     * 找出所有 confidence >= 閾值的詞條，用來建偵測 index。
     * 偵測時會從這份 list 對輸入文字做掃描。
     */
    @Query("SELECT t FROM Term t WHERE t.confidence >= :minConfidence")
    List<Term> findForDetection(@Param("minConfidence") Float minConfidence);
}
