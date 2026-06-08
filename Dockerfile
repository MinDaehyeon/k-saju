FROM oven/bun:1
WORKDIR /app
COPY . .
ENV PORT=8912
# 영속 DB: 마운트 디스크 경로(아래 render.yaml의 disk)로
ENV KSAJU_DB=/app/data/ksaju.db
EXPOSE 8912
CMD ["bun","server.ts"]
