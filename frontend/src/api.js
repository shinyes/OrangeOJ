const defaultHeaders = {
  'Content-Type': 'application/json'
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
    throw new Error(message)
  }

  return data?.data
}

export const api = {
  me: () => apiFetch('/api/auth/me'),
  login: (body) => apiFetch('/api/auth/login', { method: 'POST', body }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  register: (body) => apiFetch('/api/auth/register', { method: 'POST', body }),

  getRegistration: () => apiFetch('/api/admin/settings/registration'),
  setRegistration: (enabled) => apiFetch('/api/admin/settings/registration', { method: 'PUT', body: { enabled } }),

  listRootProblems: () => apiFetch('/api/admin/root-problems'),
  createRootProblem: (body) => apiFetch('/api/admin/root-problems', { method: 'POST', body }),

  listAdminSpaces: () => apiFetch('/api/admin/spaces'),
  createSpace: (body) => apiFetch('/api/admin/spaces', { method: 'POST', body }),

  listSpaces: () => apiFetch('/api/spaces'),
  getSpace: (spaceId) => apiFetch(`/api/spaces/${spaceId}`),

  listSpaceProblems: (spaceId) => apiFetch(`/api/spaces/${spaceId}/problem-bank-links`),
  addSpaceProblem: (spaceId, problemId) => apiFetch(`/api/spaces/${spaceId}/problem-bank-links`, { method: 'POST', body: { problemId } }),
  getProblem: (spaceId, problemId) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}`),

  listTrainingPlans: (spaceId) => apiFetch(`/api/spaces/${spaceId}/training-plans`),
  createTrainingPlan: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}/training-plans`, { method: 'POST', body }),
  joinTrainingPlan: (spaceId, planId) => apiFetch(`/api/spaces/${spaceId}/training-plans/${planId}/join`, { method: 'POST' }),

  listHomeworks: (spaceId) => apiFetch(`/api/spaces/${spaceId}/homeworks`),
  createHomework: (spaceId, body) => apiFetch(`/api/spaces/${spaceId}/homeworks`, { method: 'POST', body }),

  objectiveSubmit: (spaceId, problemId, answer) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/objective-submit`, { method: 'POST', body: { answer } }),
  run: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/run`, { method: 'POST', body }),
  test: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/test`, { method: 'POST', body }),
  submit: (spaceId, problemId, body) => apiFetch(`/api/spaces/${spaceId}/problems/${problemId}/submit`, { method: 'POST', body }),
  getSubmission: (submissionId) => apiFetch(`/api/submissions/${submissionId}`),
  pollSubmission: (submissionId) => apiFetch(`/api/submissions/${submissionId}/stream`)
}
