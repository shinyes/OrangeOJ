# 🍊 OrangeOJ 前端

React 18 + Vite + Tailwind CSS + shadcn/ui。

## 快速开始

```bash
npm install && npm run dev
```

访问 `http://localhost:5173`。

## 构建

```bash
npm run build
```

产物输出到 `dist/`，由后端静态托管。

## 项目结构

```
src/
├── components/
│   ├── dashboard/       # 业务组件（LearningPanel/SpaceManagePanel/SystemPanel/编辑器等）
│   └── ui/              # shadcn/ui 基础组件
├── pages/               # 页面组件
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   ├── CodingPage.jsx
│   ├── HomeworkPage.jsx
│   ├── HomeworkProgrammingPage.jsx
│   ├── HomeworkSubmissionRecordsPage.jsx
│   └── TrainingPage.jsx
├── hooks/               # useDashboardData / useDashboardActions 等
├── utils/               # problemDrafts / userScopedStorage 等
├── api.js               # API 客户端封装
├── App.jsx
└── main.jsx
```

## 技术栈

- React 18 + React Router DOM
- Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- Monaco Editor
- marked + KaTeX + DOMPurify
- Sonner (toast)
- date-fns
