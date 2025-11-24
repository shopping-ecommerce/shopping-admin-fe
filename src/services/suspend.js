// src/services/suspend.js
import { apiUrl } from 'src/config/api';

/** Upload nhiều ảnh bằng chứng -> trả về mảng URL */
export async function uploadEvidence(authFetch, files = []) {
  if (!files?.length) return [];
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await authFetch(apiUrl('/file/s3/upload'), { method: 'POST', body: fd });
  const raw = await res.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
  if (!res.ok || data?.code !== 200) throw new Error(data?.message || `HTTP ${res.status}`);
  return Array.isArray(data?.result) ? data.result : [];
}

/** Tạm ngưng một sản phẩm */
export async function suspendProduct(authFetch, productId, reason = '') {
  const url = apiUrl(`/product/suspend/${encodeURIComponent(productId)}?reason=${encodeURIComponent(reason || '')}`);
  const res = await authFetch(url, { method: 'POST' });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return true;
}

/** Gửi report vi phạm seller (JSON chuẩn, có product_id) */
export async function reportSellerViolation(authFetch, {
  seller_id,
  product_id,                 // << bắt buộc
  violation_type,
  description,
  evidence_urls = [],
}) {
  const res = await authFetch(apiUrl('/info/sellers/report-violation'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, // << QUAN TRỌNG
    body: JSON.stringify({ seller_id, product_id, violation_type, description, evidence_urls }),
  });
  const raw = await res.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
  if (!res.ok || (data?.code && data.code !== 200)) throw new Error(data?.message || `HTTP ${res.status}`);
  return data?.result ?? true;
}

/**
 * Gói tiện ích giống cách bạn dùng ở ProductList:
 * - upload ảnh -> report-violation (có product_id) -> suspend product
 */
export async function suspendWithEvidence(authFetch, {
  productId,
  sellerId,
  violationType = 'FAKE_PRODUCT',
  description = 'Vi phạm chính sách',
  reason = 'Tạm ngưng do vi phạm',
  evidenceFiles = [],
}) {
  // 1) Upload ảnh
  const evidence_urls = await uploadEvidence(authFetch, evidenceFiles);

  // 2) Gửi report có kèm product_id
  if (!sellerId) throw new Error('Thiếu sellerId để report vi phạm');
  if (!productId) throw new Error('Thiếu productId để report vi phạm');

  await reportSellerViolation(authFetch, {
    seller_id: sellerId,
    product_id: productId,              // << đảm bảo có product_id
    violation_type: violationType,
    description,
    evidence_urls,
  });

  // 3) Tạm ngưng sản phẩm
  await suspendProduct(authFetch, productId, reason);
  return { evidence_urls };
}
