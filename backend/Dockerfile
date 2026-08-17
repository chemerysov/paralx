# stage 1: build the Astro frontend
FROM node:24-alpine AS frontend-builder
RUN npm install -g pnpm@10.33.2
WORKDIR /build
# docker optimization: if package.json and pnpm-lock.yaml dont change
# then no pnpm install necessary
COPY frontend/package.json frontend/pnpm-lock.yaml ./
# --frozen-lockfile doesnt change pnpm-lock.yaml for reproducibility
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# stage 2: build the Go server binary
FROM golang:1.26-alpine AS backend-builder
WORKDIR /build
# docker optimization: the same idea as the previous stage
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN go build -o paralx ./

# stage 3: minimal production image
FROM alpine:3.21
# ca-certificates is still required: the backend calls the FRED API over HTTPS
# and has to verify its certificate. It no longer presents one of its own.
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-builder /build/paralx ./
COPY --from=frontend-builder /build/dist ./dist
# Plain HTTP only. The Caddy proxy in front terminates TLS and is the only
# thing bound to 80/443 on the host.
EXPOSE 8080
CMD ["./paralx"]
