package io.taiwords.api.api;

import io.taiwords.api.api.dto.DetectRequest;
import io.taiwords.api.api.dto.DetectResponse;
import io.taiwords.api.service.DetectionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/detect")
public class DetectController {

    private final DetectionService detectionService;

    public DetectController(DetectionService detectionService) {
        this.detectionService = detectionService;
    }

    @PostMapping
    public DetectResponse detect(@Valid @RequestBody DetectRequest req) {
        // options 為 null → 傳 null minConfidence，讓 DetectionService 套自己的
        // taiwords.detection.default-min-confidence (application.yml 配置)。
        // 不在 DTO 層 hardcode 數值，避免 default 在兩處不同步。
        Float minConfidence = req.options() == null ? null : req.options().minConfidence();
        return detectionService.detect(req.text(), minConfidence);
    }
}
