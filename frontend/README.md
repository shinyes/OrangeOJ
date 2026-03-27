# 🍊 OrangeOJ 前端

现代化的在线判题平台前端界面。

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/          # UI 组件
│   │   ├── Button.jsx       # 按钮组件
│   │   ├── Card.jsx         # 卡片组件
│   │   ├── Input.jsx        # 输入框组件
│   │   └── Icons.jsx        # 图标库
│   ├── pages/               # 页面组件
│   │   ├── LoginPage.jsx    # 登录页
│   │   ├── RegisterPage.jsx # 注册页
│   │   ├── DashboardPage.jsx# 仪表盘
│   │   └── CodingPage.jsx   # 编程页
│   ├── styles/
│   │   └── global.css       # 全局样式
│   ├── api.js               # API 客户端
│   ├── App.jsx              # 主应用
│   └── main.jsx             # 入口文件
├── package.json
└── vite.config.js
```

## 🎨 设计特色

- **主题色**: 活力橙色 (#f97316)
- **组件化**: Button, Card, Input, Icons
- **响应式**: 完美适配各种屏幕尺寸
- **流畅动画**: 平滑的过渡效果

## 🧩 可用组件

### Button 按钮
```jsx
import Button from './components/Button'

<Button variant="primary">主要按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button size="sm">小按钮</Button>
<Button loading>加载中...</Button>
```

### Card 卡片
```jsx
import Card from './components/Card'

<Card title="标题">
  <p>卡片内容</p>
</Card>
```

### Input 输入框
```jsx
import Input from './components/Input'
import { IconUser } from './components/Icons'

<Input 
  label="用户名" 
  leftAddon={<IconUser />}
  placeholder="请输入用户名"
/>
```

### Icons 图标
```jsx
import { IconUser, IconSettings, IconCode } from './components/Icons'

<IconUser size={16} />
```

## 🛠️ 技术栈

- React 18
- React Router DOM
- Vite
- Monaco Editor

## 📱 响应式断点

- Mobile: < 640px
- Tablet: 640px - 980px
- Desktop: > 980px

---

**OrangeOJ** - 简洁高效的在线判题与教学平台 🍊
