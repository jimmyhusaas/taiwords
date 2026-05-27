package io.taiwords.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * CORS 設定。
 *
 * Phase 2 動機：Chrome 擴充套件的 content script 從任意網頁 origin
 * （例如 https://tw.news.yahoo.com）對 http://localhost:8080 發 fetch，
 * 是跨域請求。Spring Boot 預設會擋，要由 server 端發出
 * Access-Control-Allow-Origin header 才能放行。
 *
 * 預設 `*` 允許任何 origin（含 chrome-extension:// 與一般網頁）。
 * Phase 3 部署到 public URL 時，建議透過環境變數
 * TAIWORDS_CORS_ALLOWED_ORIGINS 收緊為具體網域清單（逗號分隔）。
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(
            @Value("${taiwords.cors.allowed-origins:*}") String origins) {
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
