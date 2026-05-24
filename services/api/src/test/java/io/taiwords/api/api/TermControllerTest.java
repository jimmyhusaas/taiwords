package io.taiwords.api.api;

import io.taiwords.api.domain.Term;
import io.taiwords.api.domain.TermType;
import io.taiwords.api.repository.TermRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TermController.class)
class TermControllerTest {

    @Autowired MockMvc mvc;
    @MockBean TermRepository termRepository;

    private static Term term(String slug, String zhTw, String zhCn) {
        return new Term(slug, zhTw, zhCn, TermType.SAME_MEANING_DIFF_NAME, 0.95f, false);
    }

    @Test
    void list_returns_paged_results_with_default_params() throws Exception {
        Page<Term> page = new PageImpl<>(
                List.of(term("video-shipin", "影片", "视频"),
                        term("net-wangluo", "網路", "网络")),
                PageRequest.of(0, 20), 2);
        when(termRepository.search(eq(null), any(Pageable.class))).thenReturn(page);

        mvc.perform(get("/api/v1/terms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].slug").value("video-shipin"))
                .andExpect(jsonPath("$.content[0].canonicalZhTw").value("影片"))
                .andExpect(jsonPath("$.content[0].canonicalZhCn").value("视频"))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void list_forwards_keyword_param_to_repository() throws Exception {
        when(termRepository.search(eq("视频"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(term("video-shipin", "影片", "视频"))));

        mvc.perform(get("/api/v1/terms").param("keyword", "视频"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));

        verify(termRepository).search(eq("视频"), any(Pageable.class));
    }

    @Test
    void list_caps_page_size_to_100() throws Exception {
        when(termRepository.search(any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        mvc.perform(get("/api/v1/terms").param("size", "999"))
                .andExpect(status().isOk());

        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(termRepository).search(any(), captor.capture());
        assert captor.getValue().getPageSize() == 100 : "page size should cap at 100";
    }

    @Test
    void get_one_returns_200_when_found() throws Exception {
        when(termRepository.findBySlug("video-shipin"))
                .thenReturn(Optional.of(term("video-shipin", "影片", "视频")));

        mvc.perform(get("/api/v1/terms/video-shipin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("video-shipin"))
                .andExpect(jsonPath("$.canonicalZhCn").value("视频"));
    }

    @Test
    void get_one_returns_404_when_not_found() throws Exception {
        when(termRepository.findBySlug("unknown-slug")).thenReturn(Optional.empty());

        mvc.perform(get("/api/v1/terms/unknown-slug"))
                .andExpect(status().isNotFound());
    }
}
