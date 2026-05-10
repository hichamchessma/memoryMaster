import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('mm_guest_token') || localStorage.getItem('mm_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mm_token')
      localStorage.removeItem('mm_user')
      sessionStorage.removeItem('mm_guest_token')
      sessionStorage.removeItem('mm_guest_user')
      window.location.href = '/auth'
    }
    return Promise.reject(err)
  }
)

export default api
