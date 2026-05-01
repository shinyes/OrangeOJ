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

function getOptionStrings(bodyJson) {
  return Array.isArray(bodyJson?.options) ? bodyJson.options.map((item) => String(item ?? '').trim()) : []
}

function optionIndexFromLabel(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (raw.length === 1 && raw >= 'A' && raw <= 'Z') {
    return raw.charCodeAt(0) - 65
  }
  return -1
}

function integerFromValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function normalizeSingleChoiceAnswerJson(bodyJson, answerJson) {
  const options = getOptionStrings(bodyJson)
  if (options.length === 0 || !answerJson || Array.isArray(answerJson) || typeof answerJson !== 'object') {
    return answerJson && typeof answerJson === 'object' && !Array.isArray(answerJson) ? answerJson : {}
  }

  const normalizeAnswerValue = (value) => {
    const raw = String(value ?? '').trim()
    const exactMatch = options.find((option) => option.toLowerCase() === raw.toLowerCase())
    if (exactMatch) return exactMatch

    const labelIndex = optionIndexFromLabel(raw)
    if (labelIndex >= 0 && labelIndex < options.length) {
      return options[labelIndex]
    }

    return raw
  }

  if (Object.prototype.hasOwnProperty.call(answerJson, 'answer')) {
    return {
      ...answerJson,
      answer: normalizeAnswerValue(answerJson.answer)
    }
  }

  for (const key of ['correctIndex', 'answerIndex', 'correctAnswerIndex']) {
    const index = integerFromValue(answerJson[key])
    if (index !== null && index >= 0 && index < options.length) {
      return {
        ...answerJson,
        answer: options[index]
      }
    }
  }

  for (const key of ['correctOption', 'correctLabel', 'correctAnswer']) {
    if (Object.prototype.hasOwnProperty.call(answerJson, key)) {
      return {
        ...answerJson,
        answer: normalizeAnswerValue(answerJson[key])
      }
    }
  }

  return answerJson
}

export function normalizeObjectiveAnswerJson(type, bodyJson, answerJson) {
  if (type === 'single_choice') {
    return normalizeSingleChoiceAnswerJson(bodyJson, answerJson)
  }
  if (type === 'true_false' && answerJson && typeof answerJson === 'object' && !Array.isArray(answerJson)) {
    for (const key of ['answer', 'correct', 'correctAnswer', 'value']) {
      if (Object.prototype.hasOwnProperty.call(answerJson, key)) {
        const value = answerJson[key]
        if (value === true || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1') {
          return { ...answerJson, answer: true }
        }
        if (value === false || String(value).trim().toLowerCase() === 'false' || String(value).trim() === '0') {
          return { ...answerJson, answer: false }
        }
      }
    }
  }
  return answerJson
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
    const rawAnswerJson = item.answerJson && typeof item.answerJson === 'object' && !Array.isArray(item.answerJson) ? item.answerJson : {}
    const answerJson = normalizeObjectiveAnswerJson(type, bodyJson, rawAnswerJson)

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
