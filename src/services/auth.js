import { API_CONFIG, apiUrl } from '../config/api';

const BASE = API_CONFIG.baseUrl;
const EP   = API_CONFIG.endpoints.auth;

const safeJson = async (res) => {
  const t = await res.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return { message: t }; }
};

const normalizeToken = (t) => (t && t.startsWith('Bearer ')) ? t.slice(7) : t;

const deepPickToken = (root) => {
  if (!root || typeof root !== 'object') return null;
  const stack = [root];
  const cand = new Set(['jwttoken','jwt_token','accesstoken','access_token','token','jwt','id_token']);
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    for (const [k, v] of Object.entries(cur)) {
      const lk = k.toLowerCase();
      if (cand.has(lk)) {
        if (typeof v === 'string' && v) return v;
        if (v && typeof v === 'object') stack.push(v);
      } else if (v && typeof v === 'object') {
        stack.push(v);
      }
    }
  }
  return null;
};

async function request(path, method = 'POST', body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json?.result ?? json;
}

export const loginEmailPassword = async ({ email, password }) => {
  const url = `${BASE}${EP.login}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const json = await safeJson(res);
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  const payload = json?.result ?? json;

  let token = deepPickToken(payload);
  if (!token && payload && payload.jwt_token) token = payload.jwt_token;

  if (!token) {
    const hAuth = res.headers.get('Authorization') || res.headers.get('authorization');
    const hAcc  = res.headers.get('X-Access-Token') || res.headers.get('x-access-token') || res.headers.get('X-Auth-Token');
    const hTok  = res.headers.get('X-Token') || res.headers.get('x-token');
    token = hAuth || hAcc || hTok || null;
  }

  token = normalizeToken(token);
  return { ...payload, jwtToken: token };
};

export const register  = (payload) => request(EP.register,  'POST', payload);
export const verifyOtp = (payload) => request(EP.verifyOtp, 'POST', payload);
export const refresh   = (token)   => request(EP.refresh,   'POST', { token });
export const logout    = ()        => request(EP.logout,    'POST');
export { logout as doLogout };
