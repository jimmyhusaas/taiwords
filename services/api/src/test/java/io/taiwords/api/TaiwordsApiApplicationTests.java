package io.taiwords.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 最小化 smoke test：Spring context 起得來。
 * Phase 1 完整測試（含 Testcontainers + Postgres）會在後續加入。
 */
@SpringBootTest
@ActiveProfiles("test")
class TaiwordsApiApplicationTests {

    @Test
    void contextLoads() {
        // 若 context 起不來，這個測試會炸
    }
}
