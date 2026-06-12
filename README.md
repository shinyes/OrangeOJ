# 🍊 OrangeOJ

简洁高效的在线判题与教学平台。Go + Fiber + SQLite + React + nsjail。

## 功能

- **题库管理** — 编程题 / 单选题 / 判断题，Markdown 题面 + KaTeX 公式，图片嵌入
- **在线判题** — nsjail 沙箱隔离，支持 C++ / Python / Go，cgroup v2 内存限制
- **练习系统** — 试卷 / 题单两种模式，截止时间、成员分配、云端草稿、提交记录
- **训练计划** — 章节组织、进度追踪、ZIP 导入导出（含章节结构）
- **空间管理** — 多空间隔离、管理员/成员权限、批量注册
- **响应式 UI** — Tailwind CSS + shadcn/ui，适配桌面与移动端

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go + Fiber + SQLite |
| 判题 | nsjail + cgroup v2 |
| 前端 | React 18 + Vite + Tailwind CSS + shadcn/ui |
| 编辑器 | Monaco Editor |
| 渲染 | marked + KaTeX + DOMPurify |
| CI/CD | GitHub Actions → GHCR 自动构建 |

## 快速开始（开发）

### 环境要求

- Go 1.19+
- Node.js 16+
- nsjail（判题需要）
- g++ / python3 / go（对应编程语言环境）

### 启动

```bash
# 后端 (localhost:8080)
cd backend && go run .

# 前端 (localhost:5173)
cd frontend && npm install && npm run dev
```

首次启动自动创建 `admin` / `123456` 管理员账号。

### 开发脚本

```bash
# Windows
.\scripts\start-dev.ps1

# Linux/Mac
./scripts/start-dev.sh
```

## Docker 部署

### 拉取镜像（推荐）

```bash
git clone https://github.com/shinyes/OrangeOJ.git ooj
cd ooj
docker compose -f deploy/docker-compose.pull.yml up -d
```

访问 `http://localhost:23453`，查看初始密码：

```bash
docker logs orangeoj | grep BOOTSTRAP
```

### 更新版本

```bash
cd ooj && git pull
docker compose -f deploy/docker-compose.pull.yml pull
docker compose -f deploy/docker-compose.pull.yml up -d
```

### 固定版本

将 `deploy/docker-compose.pull.yml` 中镜像 tag 改为指定版本号，如 `v0.6.7`。

### 本地构建

```bash
docker compose -f deploy/docker-compose.build.yml up -d --build
```

## 项目结构

```
OrangeOJ/
├── backend/
│   ├── main.go
│   └── internal/
│       ├── api/            # 路由、请求处理、导入导出
│       ├── auth/           # JWT / 权限中间件
│       ├── db/             # 数据库初始化与迁移
│       ├── judge/          # 判题队列与调度
│       ├── judgeserver/    # nsjail 沙箱执行器
│       └── model/          # 数据类型 / 判题结果（AC WA TLE MLE RE CE）
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── dashboard/  # 管理面板（题库/练习/训练/空间/系统）
│       │   └── ui/         # shadcn/ui 组件
│       ├── pages/          # 页面（Dashboard/Coding/Homework/Training/Login）
│       ├── hooks/          # useDashboardData / useDashboardActions 等
│       ├── utils/          # 工具函数
│       └── api.js          # API 客户端
├── deploy/                 # Docker Compose 部署配置
├── scripts/                # 开发启动/停止脚本
├── Dockerfile              # 应用镜像
├── Dockerfile.judge        # 判题运行时镜像
└── .github/workflows/      # CI（tag v* 触发构建）
```

## 关键环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ORANGEOJ_JWT_SECRET` | JWT 签名密钥 | `dev-secret-change-me` |
| `ORANGEOJ_JUDGE_SHARED_TOKEN` | 判题通信令牌 | `dev-token-change-me` |
| `ORANGEOJ_DB_PATH` | SQLite 数据库路径 | `/app/data/orangeoj.db` |
| `ORANGEOJ_JUDGE_WORKERS` | 并发判题数 | `2` |
| `ORANGEOJ_JUDGE_ENDPOINT` | 判题服务地址 | `http://judge-runtime:9090` |
| `ORANGEOJ_REGISTRATION_DEFAULT` | 注册开关 | `false` |

## 运行环境要求

- Linux + cgroup v2 + Docker Compose
- `judge-runtime` 需要 `privileged` 权限与 `cgroup: host`

## 导入导出兼容性

练习 ZIP 和训练 ZIP 可互相导入，但只有题目数据能跨格式传递：

| 场景 | 题目 | 元数据（标题/说明/标签） | 结构（章节/题目顺序） |
|------|------|--------------------------|----------------------|
| 练习 ZIP → 训练计划 | ✅ 导入并追加到第一章 | ❌ 丢失 | ❌ 无章节 |
| 训练 ZIP → 练习 | ✅ 按序导入为练习题目 | ❌ 丢失 | ❌ 章节被展平 |

两种 ZIP 均对 `images/` 目录中的图片照常提取，无需额外操作。

## License

MIT
