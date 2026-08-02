# Single-image build for testing deploys: the Go backend serves the built
# frontend itself (see cmd/api/main.go's r.NoRoute(newSPAHandler(staticDir))),
# so one container is enough - no separate frontend host/CORS setup needed.

FROM node:22-alpine AS frontend-build
WORKDIR /app/palabatu-fe
COPY palabatu-fe/package.json palabatu-fe/package-lock.json ./
RUN npm ci
COPY palabatu-fe/ ./
# Bake an empty API base URL so the built app calls relative paths
# (same-origin) instead of the localhost:3001 dev default - this container
# serves both API and frontend from the same origin.
ENV VITE_API_URL=""
RUN npm run build

FROM golang:1.26-alpine AS backend-build
WORKDIR /app/palabatu-be
COPY palabatu-be/go.mod palabatu-be/go.sum ./
RUN go mod download
COPY palabatu-be/ ./
RUN CGO_ENABLED=0 go build -o /app/bin/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-build /app/bin/api ./api
COPY --from=frontend-build /app/palabatu-fe/dist ./dist
ENV STATIC_DIR=/app/dist
EXPOSE 3001
CMD ["./api"]
