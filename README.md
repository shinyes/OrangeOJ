# OrangeOJ

OrangeOJ 是一个基于 Go + Fiber + SQLite + React + Monaco 构建的单体 OJ 平台。

## 功能特性

- 角色体系：系统管理员、空间管理员、普通用户
- 根题库 + 空间题库（空间内题目引用根题库）
- 每个空间独立页面：题库、训练计划、作业
- 题型支持：单选题、判断题、编程题
- 在 Docker 沙箱中判题，支持 C++ / Python / Go
- 基于 SQLite 的判题队列，支持可配置并发 worker
- 时间与内存限制（默认：1000ms、256MiB）
- 首次启动自动创建 `admin`（随机密码仅输出一次日志）
- 由管理员控制是否开放注册

## 使用 Docker Compose 运行

```bash
docker compose up -d --build
```

访问：`http://localhost:8080`

查看初始化 admin 密码：

```bash
docker logs orangeoj | grep BOOTSTRAP
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
