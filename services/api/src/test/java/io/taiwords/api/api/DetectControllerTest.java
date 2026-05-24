package io.taiwords.api.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.taiwords.api.api.dto.DetectResponse;
import io.taiwords.api.service.DetectionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DetectController.class)
class DetectControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean DetectionService detectionService;

    private static DetectResponse fakeResponse() {
        return new DetectResponse(
                "視頻",
                List.of(new DetectResponse.Match(
                        UUID.fromString("00000000-0000-0000-0000-000000000001"),
                        "video-shipin",
                        "視頻",
                        0,
                        2,
                        "影片",
                        0.95f,
                        "same_meaning_diff_name",
                        null
                )),
                new DetectResponse.Stats(2, 1, 1.0)
        );
    }

    @Test
    void detect_returns_matches_and_stats_for_valid_request() throws Exception {
        when(detectionService.detect(eq("視頻"), isNull())).thenReturn(fakeResponse());

        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("text", "視頻"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("視頻"))
                .andExpect(jsonPath("$.matches.length()").value(1))
                .andExpect(jsonPath("$.matches[0].matchedText").value("視頻"))
                .andExpect(jsonPath("$.matches[0].suggestedZhTw").value("影片"))
                .andExpect(jsonPath("$.matches[0].confidence").value(0.95))
                .andExpect(jsonPath("$.stats.matchCount").value(1));
    }

    @Test
    void detect_forwards_min_confidence_from_options() throws Exception {
        when(detectionService.detect(eq("視頻"), eq(0.8f))).thenReturn(fakeResponse());

        var body = Map.of(
                "text", "視頻",
                "options", Map.of("minConfidence", 0.8));
        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(detectionService).detect(eq("視頻"), eq(0.8f));
    }

    @Test
    void detect_rejects_blank_text_with_400() throws Exception {
        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detect_rejects_missing_text_with_400() throws Exception {
        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detect_rejects_oversized_text_with_400() throws Exception {
        String huge = "視".repeat(10_001);
        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("text", huge))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detect_rejects_malformed_json_with_400() throws Exception {
        mvc.perform(post("/api/v1/detect")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest());
    }
}
