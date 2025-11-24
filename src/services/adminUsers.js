// src/services/adminUsers.js
import { apiUrl } from 'src/config/api'

/**
 * Lấy danh sách user (profiles).
 * API trả { code, result: [...] }
 */
export const listUsers = async (authFetch, { signal } = {}) => {
  const res = await authFetch(apiUrl('/info/profiles'), { method: 'GET', signal })
  if (!res.ok) throw new Error(`List users failed: ${res.status}`)
  const data = await res.json()
  return data?.result ?? []
}

/**
 * Lấy chi tiết 1 user theo userId.
 * API trả { code, result: {...} }
 */
export const getUserDetail = async (authFetch, id, { signal } = {}) => {
  const res = await authFetch(apiUrl(`/info/profiles/${id}`), { method: 'GET', signal })
  if (!res.ok) throw new Error(`Get user ${id} failed: ${res.status}`)
  const data = await res.json()
  return data?.result ?? null
}

/**
 * Xoá nhiều user theo danh sách ids.
 * Body: { ids: ["userId1", "userId2", ...] }
 */
// src/services/adminUsers.js
export const deleteUsers = async (authFetch, ids, { signal } = {}) => {
  const res = await authFetch(apiUrl('/info/profiles'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    signal,
  })
  const text = await res.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }

  if (!res.ok || (data?.code && data.code !== 200)) {
    throw new Error(data?.message || `Delete users failed: ${res.status}`)
  }
  return data?.result ?? data
}


/**
 * Lấy thông tin seller theo userId để lấy email (nếu user là seller).
 * API trả { code, result: {...} } với field email.
 */
export const getSellerByUserId = async (authFetch, userId, { signal } = {}) => {
  const res = await authFetch(apiUrl(`/info/sellers/searchByUserId/${userId}`), {
    method: 'GET',
    signal,
  })
  if (!res.ok) throw new Error(`Get seller by userId failed: ${res.status}`)
  const data = await res.json()
  return data?.result ?? null
}
