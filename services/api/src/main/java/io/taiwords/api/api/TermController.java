package io.taiwords.api.api;

import io.taiwords.api.api.dto.TermDto;
import io.taiwords.api.domain.Term;
import io.taiwords.api.repository.TermRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/terms")
public class TermController {

    private final TermRepository termRepository;

    public TermController(TermRepository termRepository) {
        this.termRepository = termRepository;
    }

    @GetMapping
    public Page<TermDto> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("slug").ascending());
        return termRepository.search(keyword, pageable).map(TermDto::from);
    }

    @GetMapping("/{slug}")
    public ResponseEntity<TermDto> getOne(@PathVariable String slug) {
        return termRepository.findBySlug(slug)
                .map(TermDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
