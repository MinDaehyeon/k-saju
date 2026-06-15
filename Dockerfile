FROM oven/bun:1
WORKDIR /app
COPY . .
ENV PORT=8912
# 무료 플랜: 컨테이너 내부(재시작 시 초기화). 영구 보존은 starter+디스크 시 /app/data 로 변경
ENV KSAJU_DB=/app/ksaju.db
EXPOSE 8912
CMD ["bun","server.ts"]
