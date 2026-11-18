# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY github-static/package.json github-static/package-lock.json ./
RUN npm ci
COPY github-static/ ./
RUN npm run build

FROM golang:1.25-alpine AS server
WORKDIR /build/server
COPY go.mod server.go server_test.go ./
ENV CGO_ENABLED=0
RUN go test ./... && mkdir -p /out && go build -trimpath -ldflags="-s -w" -o /out/cambridge-dbml .

FROM alpine:3.22
COPY --from=server /out/cambridge-dbml /usr/local/bin/cambridge-dbml
COPY --from=frontend /build/frontend/dist/ /site/
ENV SITE_DIR=/site \
    LISTEN_ADDR=0.0.0.0:8011
USER 65532:65532
EXPOSE 8011
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8011/ || exit 1
ENTRYPOINT ["/usr/local/bin/cambridge-dbml"]
