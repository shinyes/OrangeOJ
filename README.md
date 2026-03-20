# OrangeOJ

OrangeOJ 是一个基于 Go + Fiber + SQLite + React + Monaco 的单体 OJ 平台。

## 功能特性

- 角色体系：系统管理员、空间管理员、普通用户
- 根题库 + 空间题库（空间内题目引用根题库）
- 每个空间独立页面：题库、训练计划、作业
- 题型支持：单选题、判断题、编程题
- 在 Docker 沙箱中判题，支持 C++ / Python / Go
- 基于 SQLite 的判题队列，支持可配置并发 worker
- 时间与内存限制（默认：1000ms、256MiB）
- 首次启动自动创建 `admin`（随机密码仅输出一次日志）
- 管理员可控制是否开放注册

## 方式一：源码构建运行

```bash
docker compose up -d --build
```

访问：`http://localhost:8080`

查看初始化 admin 密码：

```bash
docker logs orangeoj | grep BOOTSTRAP
```

## 方式二：直接拉取预构建镜像运行

仓库镜像地址（GHCR）：

- `ghcr.io/shinyes/orangeoj:latest`
- `ghcr.io/shinyes/orangeoj:v0.1.0`

可直接使用仓库内文件：

- `deploy/docker-compose.pull.yml`

启动命令：

```bash
docker compose -f deploy/docker-compose.pull.yml up -d
```

如果你想固定版本，请把 `deploy/docker-compose.pull.yml` 里的镜像改为：

```yaml
image: ghcr.io/shinyes/orangeoj:v0.1.0
```

## 直接拉取版 Docker Compose 示例

```yaml
services:
  orangeoj:
    image: ghcr.io/shinyes/orangeoj:latest
    container_name: orangeoj
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      ORANGEOJ_DB_PATH: "/app/data/orangeoj.db"
      ORANGEOJ_JUDGE_WORKERS: "2"
      ORANGEOJ_REGISTRATION_DEFAULT: "false"
      ORANGEOJ_JWT_SECRET: "change-this-in-production"
      ORANGEOJ_CORS_ORIGINS: "http://localhost:8080,http://127.0.0.1:8080"
      ORANGEOJ_IMAGE_CPP: "gcc:13.2"
      ORANGEOJ_IMAGE_PYTHON: "python:3.8-alpine"
      ORANGEOJ_IMAGE_GO: "golang:1.25-alpine"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
```

## 重要环境变量

- `ORANGEOJ_DB_PATH`（默认 `/app/data/orangeoj.db`）
- `ORANGEOJ_JUDGE_WORKERS`（默认 `2`）
- `ORANGEOJ_REGISTRATION_DEFAULT`（默认 `false`）
- `ORANGEOJ_ADMIN_PASSWORD`（可选，覆盖初始化密码）
- `ORANGEOJ_JWT_SECRET`（生产环境必须修改）
- `ORANGEOJ_CORS_ORIGINS`（逗号分隔的允许来源）
- `ORANGEOJ_IMAGE_CPP` / `ORANGEOJ_IMAGE_PYTHON` / `ORANGEOJ_IMAGE_GO`

## 本地开发

后端：

```bash
cd backend
go run ./main.go
```

前端：

```bash
cd frontend
npm install
npm run dev
```

开发模式下，Vite 会将 `/api` 代理到 `http://localhost:8080`。
