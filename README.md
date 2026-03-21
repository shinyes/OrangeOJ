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
- 初始化：admin 首次启动自动创建，随机密码仅在日志输出一次

## 判题架构（常驻 Worker + nsjail/cgroup）

当前版本采用双服务部署：

- `orangeoj`：主业务服务，负责提交入队、权限校验、结果落库
- `judge-runtime`：常驻判题服务，负责在 nsjail/cgroup 沙箱中执行代码

判题不再使用每个 case 单独 `docker run` 临时容器，而是“每次提交一个沙箱，编译一次，顺序执行所有 case”。

## 关键环境变量

主服务（orangeoj）：

- `ORANGEOJ_DB_PATH`（默认 `/app/data/orangeoj.db`）
- `ORANGEOJ_JUDGE_WORKERS`（默认 `2`）
- `ORANGEOJ_JUDGE_ENDPOINT`（默认 `http://judge-runtime:9090`）
- `ORANGEOJ_JUDGE_SHARED_TOKEN`（必改，主服务和判题服务共享鉴权）
- `ORANGEOJ_JUDGE_HTTP_TIMEOUT_SEC`（默认 `300`）
- `ORANGEOJ_REGISTRATION_DEFAULT`（默认 `false`）
- `ORANGEOJ_ADMIN_PASSWORD`（可选，覆盖初始化密码）
- `ORANGEOJ_JWT_SECRET`（生产环境必须修改）
- `ORANGEOJ_CORS_ORIGINS`

判题服务（judge-runtime）：

- `ORANGEOJ_JUDGE_RUNTIME_PORT`（默认 `9090`）
- `ORANGEOJ_JUDGE_WORKDIR`（默认 `/work/jobs`）
- `ORANGEOJ_JUDGE_COMPILE_TIMEOUT_SEC`（默认 `10`）
- `ORANGEOJ_JUDGE_SHARED_TOKEN`（必须与主服务一致）

镜像选择：

- `ORANGEOJ_IMAGE_JUDGE`（默认 `ghcr.io/shinyes/orangeoj-judge:latest`）

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

使用仓库内文件：

- `deploy/docker-compose.pull.yml`

启动：

```bash
docker compose -f deploy/docker-compose.pull.yml up -d
```

如果要固定版本（示例 `v0.3.0`）：

```yaml
orangeoj: ghcr.io/shinyes/orangeoj:v0.3.0
ORANGEOJ_IMAGE_JUDGE: ghcr.io/shinyes/orangeoj-judge:v0.3.0
```

## 拉取版 Compose 示例

```yaml
services:
  judge-runtime:
    image: "${ORANGEOJ_IMAGE_JUDGE:-ghcr.io/shinyes/orangeoj-judge:latest}"
    container_name: orangeoj-judge-runtime
    restart: unless-stopped
    environment:
      ORANGEOJ_JUDGE_RUNTIME_PORT: "9090"
      ORANGEOJ_JUDGE_WORKDIR: "/work/jobs"
      ORANGEOJ_JUDGE_COMPILE_TIMEOUT_SEC: "10"
      ORANGEOJ_JUDGE_SHARED_TOKEN: "${ORANGEOJ_JUDGE_SHARED_TOKEN:-change-this-in-production}"
    cap_add:
      - SYS_ADMIN
      - SYS_RESOURCE
      - SYS_PTRACE
    security_opt:
      - apparmor:unconfined
    volumes:
      - judge-work:/work/jobs
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:9090/healthz >/dev/null"]
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
      ORANGEOJ_JUDGE_ENDPOINT: "http://judge-runtime:9090"
      ORANGEOJ_JUDGE_SHARED_TOKEN: "${ORANGEOJ_JUDGE_SHARED_TOKEN:-change-this-in-production}"
      ORANGEOJ_JUDGE_HTTP_TIMEOUT_SEC: "300"
    depends_on:
      judge-runtime:
        condition: service_healthy
    volumes:
      - ./data:/app/data

volumes:
  judge-work:
```

## 本地开发

后端主服务：

```bash
cd backend
go run ./main.go
```

判题服务：

```bash
cd backend
go run ./cmd/judge-runtime
```

前端：

```bash
cd frontend
npm install
npm run dev
```

开发模式下，Vite 会将 `/api` 代理到 `http://localhost:8080`。
