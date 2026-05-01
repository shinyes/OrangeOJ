# OrangeOJ v0.5.9

发布时间：2026-05-01

## 本次更新

- 创建作业时支持导入题目 JSON 数组，后端会先在当前空间自动建题，再按数组顺序创建作业
- 创建训练时支持按章节导入题目 JSON 数组，后端会自动建题并挂到对应训练章节
- 作业与训练共用题目草稿 JSON 解析与校验逻辑，导入字段口径统一
- 作业页顶栏进一步简化，移除统计和时间信息，只保留模式与主要操作

## 验证

- `backend`: `go test ./...`
- `frontend`: `npm run build`

## 发布说明

本版本继续沿用：

- 主服务镜像：`ghcr.io/shinyes/orangeoj:v0.5.9`
- 判题服务镜像：`ghcr.io/shinyes/orangeoj-judge:v0.5.9`
