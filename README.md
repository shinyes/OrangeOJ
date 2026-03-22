# OrangeOJ

OrangeOJ 是一个基于 Go + Fiber + SQLite + React + Monaco 的在线 OJ 平台。

## 服务组成

- `orangeoj`：主服务（Web + API + 队列）
- `judge-runtime`：常驻判题服务（nsjail + cgroup）

## 部署方式

当前提供两种 Compose 方案：

1. 拉取已发布镜像（推荐）
2. 本地构建镜像

## 方式一：拉取已发布镜像（推荐）

使用文件：

- `deploy/docker-compose.pull.yml`

### 首次部署（先 clone）

```bash
git clone https://github.com/shinyes/OrangeOJ.git ooj
cd ooj
docker compose -f deploy/docker-compose.pull.yml up -d
```

### 更新到最新版本

```bash
cd ooj
git pull
docker compose -f deploy/docker-compose.pull.yml pull
docker compose -f deploy/docker-compose.pull.yml up -d
```

### 固定版本（示例 `v0.4.4`）

将 `deploy/docker-compose.pull.yml` 中镜像改为：

- `ghcr.io/shinyes/orangeoj:v0.4.4`
- `ghcr.io/shinyes/orangeoj-judge:v0.4.4`

## 方式二：本地构建镜像

使用文件：

- `deploy/docker-compose.build.yml`

### 首次部署（先 clone）

```bash
git clone https://github.com/shinyes/OrangeOJ.git ooj
cd ooj
docker compose -f deploy/docker-compose.build.yml up -d --build
```

### 代码更新后重新构建

```bash
cd ooj
git pull
docker compose -f deploy/docker-compose.build.yml up -d --build
```

## 访问与初始化

访问地址：

- `http://localhost:8080`

查看首次启动自动生成的 `admin` 密码：

```bash
docker logs orangeoj | grep BOOTSTRAP
```

## 关键环境变量

必须修改：

- `ORANGEOJ_JWT_SECRET`
- `ORANGEOJ_JUDGE_SHARED_TOKEN`

常用：

- `ORANGEOJ_DB_PATH`（默认 `/app/data/orangeoj.db`）
- `ORANGEOJ_JUDGE_WORKERS`（默认 `2`）
- `ORANGEOJ_JUDGE_ENDPOINT`（默认 `http://judge-runtime:9090`）
- `ORANGEOJ_JUDGE_HTTP_TIMEOUT_SEC`（默认 `300`）
- `ORANGEOJ_REGISTRATION_DEFAULT`（默认 `false`）
- `ORANGEOJ_IMAGE_JUDGE`（仅拉取版使用，默认 `ghcr.io/shinyes/orangeoj-judge:latest`）

## 运行环境要求

推荐 Linux（cgroup v2）+ Docker Compose。

`judge-runtime` 需要：

- `privileged` 权限
- `cgroup: host`
- 挂载 `/sys/fs/cgroup`
