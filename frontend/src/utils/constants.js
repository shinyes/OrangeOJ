/**
 * 应用常量配置
 */

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
}

// 题目类型
export const PROBLEM_TYPES = {
  PROGRAMMING: 'programming',
  SINGLE_CHOICE: 'single_choice',
  TRUE_FALSE: 'true_false'
}

export const PROBLEM_TYPE_LABELS = {
  [PROBLEM_TYPES.PROGRAMMING]: '编程题',
  [PROBLEM_TYPES.SINGLE_CHOICE]: '单选题',
  [PROBLEM_TYPES.TRUE_FALSE]: '判断题'
}

// 编程语言
export const LANGUAGES = {
  CPP: 'cpp',
  PYTHON: 'python',
  GO: 'go'
}

export const LANGUAGE_LABELS = {
  [LANGUAGES.CPP]: 'C++',
  [LANGUAGES.PYTHON]: 'Python',
  [LANGUAGES.GO]: 'Go'
}

// 用户角色
export const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  SPACE_ADMIN: 'space_admin',
  MEMBER: 'member'
}

export const ROLE_LABELS = {
  [ROLES.SYSTEM_ADMIN]: '系统管理员',
  [ROLES.SPACE_ADMIN]: '空间管理员',
  [ROLES.MEMBER]: '成员'
}

// 判题状态
export const JUDGE_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TIME_LIMIT_EXCEEDED: 'time_limit_exceeded',
  MEMORY_LIMIT_EXCEEDED: 'memory_limit_exceeded',
  RUNTIME_ERROR: 'runtime_error',
  COMPILATION_ERROR: 'compilation_error',
  SYSTEM_ERROR: 'system_error'
}

export const JUDGE_STATUS_LABELS = {
  [JUDGE_STATUS.PENDING]: '等待中',
  [JUDGE_STATUS.RUNNING]: '判题中',
  [JUDGE_STATUS.ACCEPTED]: '通过',
  [JUDGE_STATUS.WRONG_ANSWER]: '答案错误',
  [JUDGE_STATUS.TIME_LIMIT_EXCEEDED]: '超时',
  [JUDGE_STATUS.MEMORY_LIMIT_EXCEEDED]: '超内存',
  [JUDGE_STATUS.RUNTIME_ERROR]: '运行时错误',
  [JUDGE_STATUS.COMPILATION_ERROR]: '编译错误',
  [JUDGE_STATUS.SYSTEM_ERROR]: '系统错误'
}

export const JUDGE_STATUS_COLORS = {
  [JUDGE_STATUS.ACCEPTED]: 'var(--success)',
  [JUDGE_STATUS.WRONG_ANSWER]: 'var(--danger)',
  [JUDGE_STATUS.TIME_LIMIT_EXCEEDED]: 'var(--warning)',
  [JUDGE_STATUS.MEMORY_LIMIT_EXCEEDED]: 'var(--warning)',
  [JUDGE_STATUS.RUNTIME_ERROR]: 'var(--danger)',
  [JUDGE_STATUS.COMPILATION_ERROR]: 'var(--danger)',
  [JUDGE_STATUS.SYSTEM_ERROR]: 'var(--danger)'
}

// 默认代码模板
export const DEFAULT_CODE_TEMPLATES = {
  [LANGUAGES.CPP]: `#include <bits/stdc++.h>
using namespace std;

int main() {
  // 在此编写代码
  return 0;
}`,
  [LANGUAGES.PYTHON]: `def solve():
    # 在此编写代码
    pass

if __name__ == "__main__":
    solve()`,
  [LANGUAGES.GO]: `package main

import "fmt"

func main() {
  // 在此编写代码
  fmt.Println("Hello, World!")
}`
}

// 本地存储键名
export const STORAGE_KEYS = {
  THEME: 'orangeoj_theme',
  LAST_SPACE_ID: 'orangeoj_last_space_id',
  PREFERRED_LANGUAGE: 'orangeoj_preferred_language'
}

// API 超时时间（毫秒）
export const API_TIMEOUT = 30000

// 文件上传限制
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}

// 正则表达式
export const REGEX = {
  USERNAME: /^[a-zA-Z0-9_]{4,20}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 6
}
