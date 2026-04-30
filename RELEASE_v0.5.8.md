# OrangeOJ v0.5.8

发布时间：2026-04-30

## 本次更新

- 移除根题库功能，题目统一改为空间自有题目
- 精简空间管理与 Dashboard 结构，拆分为数据、动作、弹窗等独立 hooks
- 路由按页面懒加载，前端主包继续收敛
- 题目编辑器新增更稳的 UI / JSON 双模式双向同步
- 修复选择题编辑时选项与答案读取错误的问题
- 调整删题逻辑：历史提交不再阻止删除，作业/训练引用仍然阻止删除

## 验证

- `backend`: `go test ./...`
- `frontend`: `npm run build`

## 发布说明

本版本继续沿用：

- 主服务镜像：`ghcr.io/shinyes/orangeoj:v0.5.8`
- 判题服务镜像：`ghcr.io/shinyes/orangeoj-judge:v0.5.8`
