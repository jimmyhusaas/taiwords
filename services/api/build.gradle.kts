plugins {
    java
    id("org.springframework.boot") version "3.3.4"
    id("io.spring.dependency-management") version "1.1.6"
}

group = "io.taiwords"
version = "0.1.0-SNAPSHOT"
description = "TaiWords — Taiwan / China terminology detection API"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // ─── Spring Boot core ─────────────────────────────────────
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // ─── DB / migration ───────────────────────────────────────
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // ─── API docs ─────────────────────────────────────────────
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")

    // ─── YAML 解析（用於 SeedLoader） ─────────────────────────
    implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")

    // ─── 簡繁字符轉換（DetectionService 同時掃描簡繁兩版本 needle） ─
    // 用 s2t 字符級轉換，不做詞彙台灣化（避免「视频」→「影片」破壞偵測）
    implementation("com.github.houbb:opencc4j:1.8.1")

    // ─── 開發期工具 ───────────────────────────────────────────
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")

    // ─── 測試 ─────────────────────────────────────────────────
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:junit-jupiter:1.20.2")
    testImplementation("org.testcontainers:postgresql:1.20.2")
    // EmbeddedPostgres for integration tests — 自帶 PG 17 binary，跑真實 PG 而不需要 docker。
    // 與 testcontainers 等價的好處：開發機只要 Java 21；CI 不需要 service postgres。
    testImplementation("io.zonky.test:embedded-postgres:2.0.7")
    testImplementation(enforcedPlatform("io.zonky.test.postgres:embedded-postgres-binaries-bom:17.2.0"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("com.h2database:h2")
}

tasks.withType<Test> {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
    }
    // 把 -D 屬性從 Gradle CLI 轉發到 forked test JVM（預設不會繼承）。
    // 用於整合測試 toggle 與 DB 連線覆寫，例如：
    //   ./gradlew test -Dintegration.test=true -Dintegration.db.url=jdbc:postgresql://...
    listOf(
        "integration.test",
        "integration.db.url",
        "integration.db.user",
        "integration.db.password"
    ).forEach { key ->
        System.getProperty(key)?.let { systemProperty(key, it) }
    }
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("taiwords-api.jar")
}

// 把 repo 根的 data/seed/*.yaml 一併打包進 jar，讓 SeedLoader 可由 classpath 讀到
tasks.named<ProcessResources>("processResources") {
    from(rootProject.file("../../data/seed")) {
        into("seed")
        include("*.yaml", "*.yml")
    }
}
