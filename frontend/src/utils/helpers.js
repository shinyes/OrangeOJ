/**
 * 格式化时间戳为本地日期字符串
 * @param {number|string|Date} timestamp 
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 格式化相对时间（如：3 小时前）
 * @param {number|string|Date} timestamp 
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return formatDate(timestamp)
}

/**
 * 截断文本，超出长度部分用省略号替代
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string}
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 验证邮箱格式
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * 验证用户名格式（字母数字下划线，4-20 字符）
 * @param {string} username 
 * @returns {boolean}
 */
export function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username)
}

/**
 * 验证密码强度（至少 6 位）
 * @param {string} password 
 * @returns {boolean}
 */
export function isValidPassword(password) {
  return password && password.length >= 6
}

/**
 * 深拷贝对象
 * @template T
 * @param {T} obj 
 * @returns {T}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 防抖函数
 * @template {Function} T
 * @param {T} func 
 * @param {number} wait 
 * @returns {T}
 */
export function debounce(func, wait = 300) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @template {Function} T
 * @param {T} func 
 * @param {number} limit 
 * @returns {T}
 */
export function throttle(func, limit = 300) {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 安全地获取嵌套对象属性
 * @param {object} obj 
 * @param {string} path 
 * @param {*} defaultValue 
 * @returns {*}
 */
export function getNestedProperty(obj, path, defaultValue = undefined) {
  if (!obj || !path) return defaultValue
  const keys = path.split('.')
  let result = obj
  for (const key of keys) {
    if (result == null || !(key in result)) {
      return defaultValue
    }
    result = result[key]
  }
  return result
}

/**
 * 复制到剪贴板
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}
