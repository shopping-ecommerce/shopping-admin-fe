import { API_CONFIG, apiUrl } from "../config/api";

const toJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return { message: t }; }
};

// LẤY DANH SÁCH PENDING (endpoint trả mảng trong `result`)
export async function listPendingSellers(authFetch) {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.adminSellers.listPending), {
    method: "GET",
  });
  const data = await toJson(res);
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

  const raw = data.result ?? data ?? [];
  // Chuẩn hoá field cho UI + giữ lại giấy tờ
  return Array.isArray(raw)
    ? raw.map((r) => ({
        id:        r.id,
        userId:    r.user_id || r.userId,
        shopName:  r.shop_name || r.shopName || '—',
        email:     r.email || '—',
        avatar:    r.avatar_link || r.avatarLink || null,
        address:   r.address || '—',
        createdAt: r.registration_date || r.created_time || null,
        identificationLinks: r.identification_link || r.identificationLinks || [],
        status:    r.status || 'PENDING',
      }))
    : [];
}

// (tuỳ BE có hay chưa)
export async function getSellerDetail(authFetch, id) {
  const res = await authFetch(apiUrl(API_CONFIG.endpoints.adminSellers.detail(id)), { method: "GET" });
  const data = await toJson(res);
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.result ?? data;
}

// API duyệt/từ chối chung
export async function verifySeller(authFetch, { sellerId, status, reason }) {
  const payload = { sellerId, status };
  if (reason) payload.reason = reason;

  const res = await authFetch(apiUrl(API_CONFIG.endpoints.adminSellers.verify), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await toJson(res);
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  // có thể là {code, message, result} hoặc rỗng
  return data.result ?? data;
}

/** Lấy tất cả seller (normalize field theo JSON bạn gửi) */
export const listAllSellers = async (authFetch, { signal } = {}) => {
  const res = await authFetch(apiUrl('/info/sellers'), { method: 'GET', signal });
  const data = await toJson(res);

  // xử lý lỗi/permission
  if (res.status === 401) throw new Error('401 không được phép: token thiếu/hết hạn.');
  if (res.status === 403) throw new Error('403 cấm truy cập: không đủ quyền.');
  if (!res.ok || (data && data.code && data.code !== 200)) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const list = Array.isArray(data?.result) ? data.result : [];
  // map chuẩn theo payload thật sự trả về
  return list.map((s) => ({
    id: s.id,
    userId: s.user_id,
    shopName: s.shop_name,
    email: s.email,
    avatar: s.avatar_link,
    docs: s.identification_link || [],
    wallet: s.wallet,
    createdAt: s.registration_date,
    address: s.address,
    status: s.status,
  }));
};

export async function deleteSeller(authFetch, { sellerId, reason }) {
  const form = new FormData()
  form.append('sellerId', sellerId)
  if (reason) form.append('reason', reason)

  const res = await authFetch(apiUrl('/info/sellers/deleteSeller'), {
    method: 'DELETE',
    body: form,
  })
  const data = await toJson(res)

  if (!res.ok || (data && data.code && data.code !== 200)) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data?.result ?? data ?? {}
}