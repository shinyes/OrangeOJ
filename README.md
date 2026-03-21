# OrangeOJ

OrangeOJ 是一个基于 Go + Fiber + SQLite + React + Monaco 的在线 OJ 平台。

## 快速部署（仅拉取镜像）

OrangeOJ 采用双服务架构：

- `orangeoj`：主服务
- `judge-runtime`：常驻判题服务（nsjail + cgroup）

直接使用仓库内部署文件：

- `deploy/docker-compose.pull.yml`

启动：

```bash
docker compose -f deploy/docker-compose.pull.yml up -d
```

访问：

- `http://localhost:8080`

查看首次启动生成的 `admin` 密码：

```bash
docker logs orangeoj | grep BOOTSTRAP
```

## 固定版本

默认是 `latest`。如果要固定版本（例如 `v0.3.0`），请把 compose 中镜像改为：

- `ghcr.io/shinyes/orangeoj:v0.3.0`
- `ghcr.io/shinyes/orangeoj-judge:v0.3.0`

## 关键环境变量

必改：

- `ORANGEOJ_JWT_SECRET`
- `ORANGEOJ_JUDGE_SHARED_TOKEN`

常用：

- `ORANGEOJ_DB_PATH`（默认 `/app/data/orangeoj.db`）
- `ORANGEOJ_JUDGE_WORKERS`（默认 `2`）
- `ORANGEOJ_JUDGE_ENDPOINT`（默认 `http://judge-runtime:9090`）
- `ORANGEOJ_JUDGE_HTTP_TIMEOUT_SEC`（默认 `300`）
- `ORANGEOJ_REGISTRATION_DEFAULT`（默认 `false`）
- `ORANGEOJ_IMAGE_JUDGE`（默认 `ghcr.io/shinyes/orangeoj-judge:latest`）

## 运行环境要求

推荐 Linux 服务器（cgroup v2），并使用 Docker Compose 运行。

`judge-runtime` 需要：

- `CAP_SYS_ADMIN` / `CAP_SYS_RESOURCE` / `CAP_SYS_PTRACE`
- 挂载 `/sys/fs/cgroup`

## 更新

拉取新镜像并重启：

```bash
docker compose -f deploy/docker-compose.pull.yml pull
docker compose -f deploy/docker-compose.pull.yml up -d
```
