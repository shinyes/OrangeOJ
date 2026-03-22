# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-build
WORKDIR /src/backend
ARG TARGETOS
ARG TARGETARCH
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ENV GOPROXY=${GOPROXY}
ENV GOSUMDB=${GOSUMDB}
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/orangeoj ./main.go

FROM --platform=$TARGETPLATFORM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend-build /out/orangeoj /app/orangeoj
COPY --from=frontend-build /src/frontend/dist /app/web
RUN mkdir -p /app/data

ENV ORANGEOJ_PORT=8080
ENV ORANGEOJ_DB_PATH=/app/data/orangeoj.db
ENV ORANGEOJ_JUDGE_WORKERS=2
ENV ORANGEOJ_REGISTRATION_DEFAULT=false
ENV ORANGEOJ_JUDGE_ENDPOINT=http://judge-runtime:9090
ENV ORANGEOJ_JUDGE_SHARED_TOKEN=change-this-in-production
ENV ORANGEOJ_JUDGE_HTTP_TIMEOUT_SEC=300

EXPOSE 8080
CMD ["/app/orangeoj"]
