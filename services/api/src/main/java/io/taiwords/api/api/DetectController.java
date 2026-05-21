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
        var opts = req.optionsOrDefault();
        return detectionService.detect(req.text(), opts.minConfidence());
    }
}
