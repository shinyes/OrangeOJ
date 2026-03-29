const defaultHeaders = {
  'Content-Type': 'application/json'
}

const errorMessageMap = {
  'invalid request': '请求参数不正确',
  'username and password required': '请输入用户名和密码',
  'invalid credentials': '用户名或密码错误',
  'registration is disabled': '当前未开放注册',
  'invalid username or password': '用户名或密码不合法（密码至少6 位）',
  'username already exists': '用户名已存在',
  'authentication required': '请先登录',
  'invalid token': '登录状态已失效，请重新登录',
  'system admin required': '需要系统管理员权限',
  'space admin required': '当前账号为普通成员，无空间管理权限',
  'space membership required': '需要先加入该空间',
  'invalid spaceId': '空间不存在',
  'invalid userId': '用户ID不合法',
  'invalid role': '角色不合法',
  'invalid username': '用户名不能为空',
  'password must be at least 6 characters': '密码至少需要 6位',
  'oldPassword and newPassword required': '请输入旧密码和新密码',
  'old password incorrect': '旧密码不正确',
  'new password must be at least 6 characters': '新密码至少需要 6位',
  'user not found': '用户不存在',
  'user is not in this space': '该用户不在当前空间内',
  'cannot reset system admin password': '不能重置系统管理员密码',
  'items must contain 1 to 200 entries': '批量注册每次最多200条',
  'problem already linked': '该题目已在空间题库中',
  'problem not linked in this space': '该题目未加入当前空间',
  'invalid language': '默认编程语言不合法',
  'name required': '空间名称不能为空',
  'space name already exists': '空间名称已存在'
}

export function toFriendlyError(message) {
  const normalized = String(message || '').trim()
  if (!normalized) return '请求失败'
  return errorMessageMap[normalized] || normalized
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.error || `Request failed: ${response.status}`
    throw new Error(toFriendlyError(message))
  }

  return data?.data
}

export const api = {
  registrationStatus: () => apiFetch('/api/auth/registration-status'),
  me: () => apiFetch('/api/auth/me'),
  login: (body) => apiFetch('/api/auth/login', { method: 'POST', body }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  register: (body) => apiFetch('/api/auth/register', { method: 'POST', body }),
  changePassword: (body) => apiFetch('/api/auth/change-password', { method: 'POST', body }),

  getRegistration: () => apiFetch('/api/admin/settings/registration'),
  setRegistration: (enabled) => apiFetch('/api/admin/settings/registration', { method: 'PUT', body: { enabled } }),

  listRootProblems: () => apiFetch('/api/admin/root-problems'),
  createRootProblem: (body) => apiFetch('/api/admin/root-problems', { method: 'POST', body }),
  getRootProblem: (problemId) => apiFetch(`/api/root-problems/${problemId}`),
  updateRootProblem: (problemId, body) => apiFetch(`/api/admin/root-problems/${problemId}`, { method: 'PUT', body }),
  batchRegisterUsers: (body) => apiFetch('/api/admin/users/batch-register', { method: 'POST', body }),

  listAdminSpaces: () => apiFetch('/api/admin/spaces'),
  createSpace: (body) => apiFetch('/api/admin/spaces', { method: 'POST', body }),
  adminResetUserPassword: (userId) => apiFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' }),

  listSpaces: () => apiFetch('/api/spaces'),
  getSpace: (spaceId) => apiFetch(`/api/spaces/${spaceId}`),
  updateSpace: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}`, { method: 'PUT', body }),

  listSpaceProblems: (spaceId) => apiFetch(`/api/spaces/${spaceId}/problem-bank-links`),
  listSpaceRootProblems: (spaceId) => apiFetch(`/api/spaces/${spaceId}/root-problems`),
  createSpaceProblem: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}/problems`, { method: 'POST', body }),
  updateSpaceProblem: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}`, { method: 'PUT', body }),
  addSpaceProblem: (spaceId, problemId) => apiFetch(`/api/spaces/${spaceId}/problem-bank-links`, { method: 'POST', body: { problemId } }),
  deleteSpaceProblem: (spaceId, problemId) => apiFetch(`/api/spaces/${spaceId}/problem-bank-links/${problemId}`, { method: 'DELETE' }),
  addSpaceMember: (spaceId, userId, role = 'member') => apiFetch(`/api/spaces/${spaceId}/members`, { method: 'POST', body: { userId, role } }),
  resetSpaceMemberPassword: (spaceId, userId) => apiFetch(`/api/spaces/${spaceId}/members/${userId}/reset-password`, { method: 'POST' }),
  getProblem: (spaceId, problemId) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}`),

  listTrainingPlans: (spaceId) => apiFetch(`/api/spaces/${spaceId}/training-plans`),
  createTrainingPlan: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}/training-plans`, { method: 'POST', body }),
  joinTrainingPlan: (spaceId, planId) => apiFetch(`/api/spaces/${spaceId}/training-plans/${planId}/join`, { method: 'POST' }),

  listHomeworks: (spaceId) => apiFetch(`/api/spaces/${spaceId}/homeworks`),
  createHomework: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}/homeworks`, { method: 'POST', body }),
  getHomework: (spaceId, homeworkId) => apiFetch(`/api/spaces/${spaceId}/homeworks/${homeworkId}`),
  addHomeworkTarget: (spaceId, homeworkId, userId) => apiFetch(`/api/spaces/${spaceId}/homeworks/${homeworkId}/targets`, { method: 'POST', body: { userId } }),

  objectiveSubmit: (spaceId, problemId, answer) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/objective-submit`, { method: 'POST', body: { answer } }),
  run: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/run`, { method: 'POST', body }),
  test: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/test`, { method: 'POST', body }),
  submit: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/submit`, { method: 'POST', body }),
  getSubmission: (submissionId) => apiFetch(`/api/submissions/${submissionId}`),
  pollSubmission: (submissionId) => apiFetch(`/api/submissions/${submissionId}/stream`),

  listImageTags: () => apiFetch('/api/image-tags'),
  createImageTag: (body) => apiFetch('/api/image-tags', { method: 'POST', body }),
  deleteImageTag: (tagId) => apiFetch(`/api/image-tags/${tagId}`, { method: 'DELETE' }),
  linkImageTag: (imageUrl, tagId) => apiFetch('/api/image-tags/link', { method: 'POST', body: { imageUrl, tagId } }),
  unlinkImageTag: (imageUrl, tagId) => apiFetch('/api/image-tags/unlink', { method: 'DELETE', body: { imageUrl, tagId } }),
  getImageTags: (imageUrl) => apiFetch(`/api/image-tags/image/${encodeURIComponent(imageUrl)}`),
  getImagesByTag: (tagId) => apiFetch(`/api/image-tags/tag/${tagId}/images`)
}
