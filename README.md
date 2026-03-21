# OrangeOJ

OrangeOJ 是一个基于 Go + Fiber + SQLite + React + Monaco 的单体 OJ 平台。

## 功能概览

- 角色体系：系统管理员、空间管理员、普通用户
- 根题库 + 多空间题库（空间题目引用根题）
- 空间页面：题库、训练计划、作业
- 题型支持：单选题、判断题、编程题
- 判题语言：C++ / Python / Go
- 判题队列：基于 SQLite，无需 Redis
- 资源限制：默认 1000ms / 256MiB
- 初始化：首次启动自动创建 `admin`，随机密码仅在日志输出一次
- 注册控制：系统管理员可开关公开注册

## 判题镜像与可用性

OrangeOJ 仅支持一个判题镜像配置项：

- `ORANGEOJ_IMAGE_JUDGE`

推荐值：

- `ghcr.io/shinyes/orangeoj-judge:latest`

为提升可用性，Compose 默认包含独立的 `judge-runtime` 服务，系统会先等待其健康后再启动主服务。

迁移说明：

- 旧配置：`ORANGEOJ_IMAGE_CPP` / `ORANGEOJ_IMAGE_PYTHON` / `ORANGEOJ_IMAGE_GO`
- 新配置：`ORANGEOJ_IMAGE_JUDGE`

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

应用镜像：

- `ghcr.io/shinyes/orangeoj:latest`

判题镜像：

- `ghcr.io/shinyes/orangeoj-judge:latest`

使用仓库内部署文件：

- `deploy/docker-compose.pull.yml`

启动：

```bash
docker compose -f deploy/docker-compose.pull.yml up -d
```

如果你要固定版本，请把镜像改为对应 tag，例如：

```yaml
image: ghcr.io/shinyes/orangeoj:v0.3.0
```

以及：

```yaml
ORANGEOJ_IMAGE_JUDGE: ghcr.io/shinyes/orangeoj-judge:v0.3.0
```

## 拉取版 Docker Compose 示例

```yaml
services:
  judge-runtime:
    image: "${ORANGEOJ_IMAGE_JUDGE:-ghcr.io/shinyes/orangeoj-judge:latest}"
    container_name: orangeoj-judge-runtime
    restart: unless-stopped
    command: ["sh", "-lc", "sleep infinity"]
    healthcheck:
      test: ["CMD-SHELL", "g++ --version >/dev/null 2>&1 && python3 --version >/dev/null 2>&1 && go version >/dev/null 2>&1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

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
      ORANGEOJ_IMAGE_JUDGE: "${ORANGEOJ_IMAGE_JUDGE:-ghcr.io/shinyes/orangeoj-judge:latest}"
    depends_on:
      judge-runtime:
        condition: service_healthy
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
- `ORANGEOJ_CORS_ORIGINS`（逗号分隔）
- `ORANGEOJ_IMAGE_JUDGE`（统一判题镜像）

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
