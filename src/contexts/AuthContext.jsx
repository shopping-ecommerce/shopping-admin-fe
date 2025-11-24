// src/contexts/AuthContext.jsx (ADMIN)
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext(null);

/* ===== Helpers cho token admin ===== */
const ADMIN_TOKEN_KEY = "admin_token";

const saveToken = (t) => {
  try {
    if (t) localStorage.setItem(ADMIN_TOKEN_KEY, t);
  } catch {}
};
const getStoredToken = () => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || null;
  } catch {
    return null;
  }
};
const clearAllTokens = () => {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
};

const getUserFromToken = (t) => {
  if (!t) return null;
  const p = jwtDecode(t);
  const roles = Array.isArray(p.roles)
    ? p.roles.map((r) => String(r).replace(/^ROLE_/, "").toUpperCase())
    : [];
  return {
    id: p.uid || p.sub || null,
    email: p.email || p.user_email || p.preferred_username || "",
    roles,
    exp: typeof p.exp === "number" ? p.exp : null,
  };
};

const isTokenExpired = (t) => {
  try {
    const u = getUserFromToken(t);
    if (!u?.exp) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return u.exp <= nowSec;
  } catch {
    return true;
  }
};

const getTokenTimeRemaining = (t) => {
  try {
    const u = getUserFromToken(t);
    if (!u?.exp) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    return Math.max(0, u.exp - nowSec);
  } catch {
    return 0;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(() => {
    const t = getStoredToken();
    if (!t || isTokenExpired(t)) return null;
    return getUserFromToken(t);
  });
  const [authReady, setAuthReady] = useState(false);

  /* Áp token vào state + storage, kèm kiểm tra hạn */
  const applyToken = useCallback((jwtToken) => {
    if (!jwtToken) {
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
      return;
    }
    if (isTokenExpired(jwtToken)) {
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
      return;
    }
    try {
      const u = getUserFromToken(jwtToken);
      if (!u) throw new Error("Cannot decode user from token");
      setToken(jwtToken);
      setUser(u);
      saveToken(jwtToken);
      setAuthReady(true);
    } catch (e) {
      console.error("applyToken decode failed:", e);
      setToken(null);
      setUser(null);
      clearAllTokens();
      setAuthReady(true);
    }
  }, []);

  /* Lấy token từ URL (hash dạng #/path?token=...) lần đầu */
  useEffect(() => {
    const hash = window.location.hash || "";
    const parts = hash.split("?");
    if (parts.length > 1) {
      const urlParams = new URLSearchParams(parts[1]);
      const tokenFromUrl = urlParams.get("token");
      if (tokenFromUrl) {
        saveToken(tokenFromUrl);
        applyToken(tokenFromUrl);
        // Xoá query token khỏi URL (giữ nguyên hash path)
        const cleanHash = parts[0]; // phần trước '?'
        window.history.replaceState({}, document.title, window.location.pathname + cleanHash);
        return;
      }
    }
    // Không có token trên URL → thử lấy từ storage
    const stored = getStoredToken();
    if (stored && !isTokenExpired(stored)) {
      applyToken(stored);
    } else {
      clearAllTokens();
      setAuthReady(true);
    }
  }, [applyToken]);

  /* Tự logout khi token hết hạn */
  useEffect(() => {
    if (!token || !authReady) return;
    const remain = getTokenTimeRemaining(token);
    if (remain <= 0) {
      logout();
      return;
    }
    const t = setTimeout(() => {
      logout();
    }, remain * 1000);
    return () => clearTimeout(t);
  }, [token, authReady]);

  const authFetch = useCallback(
    async (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [token]
  );

  const logout = useCallback(() => {
    clearAllTokens();
    setToken(null);
    setUser(null);
    setAuthReady(true);
  }, []);

  const roles = user?.roles || [];
  const isAdmin = roles.includes("ADMIN");

  const value = useMemo(
    () => ({
      token,
      user,
      roles,
      isAdmin,
      isAuthenticated: authReady && !!token && !!user && isAdmin, // chỉ coi là đăng nhập khi có role ADMIN
      authReady,
      authFetch,
      applyToken, // nếu cần apply lại token từ nơi khác
      logout,
    }),
    [token, user, roles, isAdmin, authReady, authFetch, applyToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
