// src/services/policy.js
import { apiUrl } from "../config/api";

/** LẤY TRẠNG THÁI CHÍNH SÁCH CỦA SELLER */
export async function getSellerPolicyStatus(authFetch, sellerId) {
  if (!authFetch) throw new Error("Missing authFetch");
  if (!sellerId) throw new Error("Missing sellerId");

  const url = apiUrl(
    `/policy/policies/seller-tos/status/sellers/${encodeURIComponent(sellerId)}`
  );

  const res = await authFetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data; // dạng giống payload bạn đã paste
}

/** (để nguyên) acceptSellerPolicy ... */
export async function acceptSellerPolicy(authFetch, sellerId, opts = {}) {
  if (!authFetch) throw new Error("Missing authFetch");
  if (!sellerId) throw new Error("Missing sellerId");

  const url = apiUrl(
    `/policy/policies/seller-tos/consents/sellers/${encodeURIComponent(sellerId)}/accept`
  );

  const headers = {
    Accept: "application/json",
    ...(opts.forwardedFor ? { "X-Forwarded-For": opts.forwardedFor } : {}),
  };

  const res = await authFetch(url, {
    method: "POST",
    headers,
  });

  if ([200, 201, 204].includes(res.status)) {
    let data = null;
    try {
      const t = await res.text();
      data = t ? JSON.parse(t) : null;
    } catch {}
    return { ok: true, status: res.status, data };
  }

  if (res.status === 409) {
    let data = null;
    try {
      const t = await res.text();
      data = t ? JSON.parse(t) : null;
    } catch {}
    return { ok: true, status: res.status, data, alreadyAccepted: true };
  }

  const errorText = await res.text();
  return { ok: false, status: res.status, error: errorText || `HTTP ${res.status}` };
}
