# OrangeOJ v0.5.11

发布时间：2026-05-01

## 本次更新

- 修复通过作业 JSON 数组创建选择题时，导入答案和实际保存答案不一致的问题
- 修复通过训练章节 JSON 数组创建选择题时，`correctIndex` 没有规范化为系统标准答案的问题
- 新增客观题答案规范化逻辑，统一支持 `answer`、`correctIndex`、`answerIndex`、`correctAnswerIndex`、`correctOption`、`correctLabel`、`correctAnswer`
- 编辑题目时兼容历史导入数据，旧的索引或选项标号写法也能正确回显到 UI
- 客观题提交判题兼容历史答案格式，避免旧数据因为缺少 `answerJson.answer` 无法判题

## 验证

- `backend`: `go test ./...`
- `frontend`: `npm run build`

## 发布说明

本版本发布镜像：

- 主服务镜像：`ghcr.io/shinyes/orangeoj:v0.5.11`
- 判题服务镜像：`ghcr.io/shinyes/orangeoj-judge:v0.5.11`
