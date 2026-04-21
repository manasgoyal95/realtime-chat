# --- Stage 1: Build the React frontend ---
FROM node:20-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# Vite is configured to emit to ../internal/spa/dist — make that dir exist.
RUN mkdir -p /app/internal/spa/dist
RUN npm run build

# --- Stage 2: Build the Go binary (with embedded frontend) ---
FROM golang:1.26-alpine AS gobuild
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Overwrite the placeholder dist with the real build from stage 1.
COPY --from=web /app/internal/spa/dist ./internal/spa/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# --- Stage 3: Minimal runtime image ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=gobuild /out/server /app/server
# SQLite file default lives in /tmp (writable on all tested hosts).
# Fly.io overrides this to /data/chat.db via fly.toml to use its persistent volume.
# Render free tier has no persistent disk, so /tmp is the right default.
ENV DB_PATH=/tmp/chat.db
ENV ADDR=:8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
