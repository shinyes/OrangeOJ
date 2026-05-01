export function normalizeProblemTypeValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'single_choice' || normalized === 'single-choice' || normalized === 'singlechoice') {
    return 'single_choice'
  }
  if (normalized === 'true_false' || normalized === 'true-false' || normalized === 'truefalse') {
    return 'true_false'
  }
  if (normalized === 'programming') {
    return 'programming'
  }
  return ''
}

export function parseProblemDraftArray(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    throw new Error('请输入题目 JSON 数组')
  }

  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('题目 JSON 数组不是合法 JSON')
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('题目 JSON 必须是非空数组')
  }

  return parsed.map((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') {
      throw new Error(`第 ${index + 1} 题不是合法对象`)
    }

    const type = normalizeProblemTypeValue(item.type)
    if (!type) {
      throw new Error(`第 ${index + 1} 题的 type 不合法`)
    }

    const title = String(item.title || '').trim()
    if (!title) {
      throw new Error(`第 ${index + 1} 题的 title 不能为空`)
    }

    const bodyJson = item.bodyJson && typeof item.bodyJson === 'object' && !Array.isArray(item.bodyJson) ? item.bodyJson : {}
    const answerJson = item.answerJson && typeof item.answerJson === 'object' && !Array.isArray(item.answerJson) ? item.answerJson : {}

    return {
      type,
      title,
      tags: Array.isArray(item.tags) ? item.tags : [],
      statementMd: String(item.statementMd || ''),
      bodyJson,
      answerJson,
      timeLimitMs: Number(item.timeLimitMs) > 0 ? Number(item.timeLimitMs) : 1000,
      memoryLimitMiB: Number(item.memoryLimitMiB) > 0 ? Number(item.memoryLimitMiB) : 256
    }
  })
}
