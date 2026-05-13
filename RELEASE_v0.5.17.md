# Release v0.5.17

## 前端框架迁移：MUI → shadcn/ui + Tailwind CSS

- 将 UI 框架从 Material UI v7 整体迁移至 shadcn/ui (Radix UI + Tailwind CSS)
- 替换所有页面和组件的实现，保持功能完全不变
- 新增 Tailwind CSS 配置及 shadcn/ui 组件库（Button, Input, Select, Dialog, DropdownMenu 等 20+ 组件）
- 应用整体橙色暖色调主题，网站 Logo 添加 🍊 橙子 emoji
- 修复下拉菜单/浮窗在部分浏览器中显示为透明的问题（CSS 变量改用逗号分隔格式）
- 移除 MUI / Emotion 相关依赖和样式文件
