# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS backend-build
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/orangeoj ./main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata docker-cli
WORKDIR /app
COPY --from=backend-build /out/orangeoj /app/orangeoj
COPY --from=frontend-build /src/frontend/dist /app/web
RUN mkdir -p /app/data

ENV ORANGEOJ_PORT=8080
ENV ORANGEOJ_DB_PATH=/app/data/orangeoj.db
ENV ORANGEOJ_JUDGE_WORKERS=2
ENV ORANGEOJ_REGISTRATION_DEFAULT=false
ENV ORANGEOJ_IMAGE_CPP=gcc:13.2
ENV ORANGEOJ_IMAGE_PYTHON=python:3.8-alpine
ENV ORANGEOJ_IMAGE_GO=golang:1.25-alpine

EXPOSE 8080
CMD ["/app/orangeoj"]
