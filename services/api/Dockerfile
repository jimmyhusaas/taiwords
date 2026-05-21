# ──────────── Build stage ────────────
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /workspace

# 先複製 build 設定，利用 layer cache 加速 dependency 下載
COPY services/api/build.gradle.kts services/api/settings.gradle.kts services/api/gradle.properties services/api/
COPY services/api/gradle services/api/gradle
COPY services/api/gradlew services/api/gradlew

# 複製 seed 資料（build.gradle 會把它 copy 進 resources）
COPY data data

# 複製 source code
COPY services/api/src services/api/src

WORKDIR /workspace/services/api
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

# ──────────── Runtime stage ────────────
FROM eclipse-temurin:21-jre
WORKDIR /app

# 用非 root 使用者啟動
RUN useradd -m -u 1001 taiwords && chown -R taiwords:taiwords /app
USER taiwords

COPY --from=builder /workspace/services/api/build/libs/taiwords-api.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
