const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const buildQuery = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aqa:auth-expired'))
    }
    const message = data?.message || 'Request failed'
    throw new Error(message)
  }

  return data
}

export const login = (payload) =>
  request('/api/auth/login', { method: 'POST', body: payload })

export const register = (payload) =>
  request('/api/auth/register', { method: 'POST', body: payload })

export const getProfile = (token) =>
  request('/api/auth/profile', { token })

export const getUsers = (token) =>
  request('/api/auth/users', { token })

export const createUser = (token, payload) =>
  request('/api/auth/users', { method: 'POST', body: payload, token })

export const updateUserById = (token, userId, payload) =>
  request(`/api/auth/users/${userId}`, { method: 'PUT', body: payload, token })

export const deleteUserById = (token, userId) =>
  request(`/api/auth/users/${userId}`, { method: 'DELETE', token })

export const getAssessments = (token, filters = {}) =>
  request(`/api/assessments${buildQuery(filters)}`, { token })

export const createAssessment = (token, payload) =>
  request('/api/assessments', { method: 'POST', body: payload, token })

export const updateAssessmentById = (token, assessmentId, payload) =>
  request(`/api/assessments/${assessmentId}`, { method: 'PUT', body: payload, token })

export const deleteAssessmentById = (token, assessmentId) =>
  request(`/api/assessments/${assessmentId}`, { method: 'DELETE', token })

export const getSummary = (token) =>
  request('/api/assessments/reports/summary', { token })

export const getAdvancedSummary = (token) =>
  request('/api/assessments/reports/advanced', { token })

export const getFacultyStudentResults = (token) =>
  request('/api/assessments/faculty/student-results', { token })

export const getClassPerformanceOverview = (token) =>
  request('/api/assessments/reports/class-performance', { token })

export const getPreferences = (token) =>
  request('/api/preferences', { token })

export const updatePreferences = (token, payload) =>
  request('/api/preferences', { method: 'PUT', body: payload, token })
