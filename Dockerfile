# Builds and runs the whole app as one image: palabatu-be's Go binary serves
# both the API and the built palabatu-fe static files (see static.go's
# newSPAHandler / STATIC_DIR) from a single origin -- there is no separate
# frontend host in production/staging.

FROM node:22-alpine AS frontend-builder
WORKDIR /app/palabatu-fe
COPY palabatu-fe/package.json palabatu-fe/package-lock.json ./
RUN npm ci
COPY palabatu-fe/ ./
# Vite inlines VITE_* vars at build time, not read at container runtime --
# must be passed as a build arg (see deploy docs for the value to use).
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM golang:1.26-alpine AS backend-builder
WORKDIR /app/palabatu-be
COPY palabatu-be/go.mod palabatu-be/go.sum ./
RUN go mod download
COPY palabatu-be/ ./
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-builder /out/api ./api
COPY --from=frontend-builder /app/palabatu-fe/dist ./palabatu-fe/dist

ENV STATIC_DIR=/app/palabatu-fe/dist
ENV PORT=3001
EXPOSE 3001

CMD ["./api"]
