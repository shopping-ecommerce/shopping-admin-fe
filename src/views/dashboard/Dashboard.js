"use client"

import { useEffect, useMemo, useState, useContext, useCallback } from "react"
import { Link } from "react-router-dom"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CProgress,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
} from "@coreui/react"
import CIcon from "@coreui/icons-react"
import { cilCloudDownload } from "@coreui/icons"
import { API_CONFIG, apiUrl } from "../../config/api"
import { AuthContext } from "../../contexts/AuthContext"
import "./Dashboard.css"

/* ========= Utils ========= */
const fmtMoney = (v = 0) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    Number(v || 0),
  )
const fmtNumber = (v = 0) => new Intl.NumberFormat("vi-VN").format(Number(v || 0))
const fmtPercent = (v = 0, d = 1) => `${Number(v || 0).toFixed(d)}%`
const fmtDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })

// an toàn múi giờ địa phương
const toYMD = (d) => {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const day = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
const todayYmd = () => toYMD(new Date())
const diffDays = (a, b) =>
  Math.max(
    1,
    Math.ceil(
      (new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 86400000,
    ) + 1,
  )
const getPrevRange = ({ startDate, endDate }) => {
  const days = diffDays(startDate, endDate)
  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (days - 1))
  return { startDate: toYMD(prevStart), endDate: toYMD(prevEnd) }
}

/* ===== Line chart Bezier path ===== */
const smoothPath = (pts) => {
  if (pts.length < 2) return ""
  const d = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const mx = (p0.x + p1.x) / 2
    d.push(`Q ${p0.x} ${p0.y}, ${mx} ${(p0.y + p1.y) / 2}`)
    d.push(`T ${p1.x} ${p1.y}`)
  }
  return d.join(" ")
}

/* ===== Robot vui ở cuối ===== */
const AnimatedRobot = () => {
  return (
    <div className="robot-container">
      <svg viewBox="0 0 280 300" className="robot-svg">
        <ellipse cx="140" cy="280" rx="50" ry="12" fill="#0891B2" opacity="0.3" />
        <rect x="90" y="250" width="35" height="20" rx="8" fill="#0891B2" className="robot-foot-left" />
        <circle cx="95" cy="270" r="6" fill="#EC4899" />
        <circle cx="115" cy="270" r="6" fill="#EC4899" />
        <rect x="155" y="250" width="35" height="20" rx="8" fill="#0891B2" className="robot-foot-right" />
        <circle cx="160" cy="270" r="6" fill="#EC4899" />
        <circle cx="180" cy="270" r="6" fill="#EC4899" />
        <rect x="105" y="200" width="18" height="50" rx="9" fill="url(#legGradient)" className="robot-leg-left" />
        <rect x="157" y="200" width="18" height="50" rx="9" fill="url(#legGradient)" className="robot-leg-right" />
        <rect x="80" y="110" width="120" height="100" rx="12" fill="url(#bodyGradient)" className="robot-body" />
        <rect x="95" y="125" width="90" height="70" rx="8" fill="rgba(255,255,255,0.1)" />
        <circle cx="115" cy="145" r="5" fill="#EC4899" opacity="0.6" />
        <circle cx="165" cy="145" r="5" fill="#EC4899" opacity="0.6" />
        <circle cx="140" cy="175" r="4" fill="#EC4899" opacity="0.5" />
        <g className="robot-arm-left">
          <rect x="50" y="130" width="30" height="20" rx="10" fill="url(#armGradient)" />
          <circle cx="50" cy="140" r="10" fill="url(#armGradient)" />
          <rect x="35" y="135" width="18" height="10" rx="5" fill="#06B6D4" />
        </g>
        <g className="robot-arm-right">
          <rect x="200" y="130" width="30" height="20" rx="10" fill="url(#armGradient)" />
          <circle cx="230" cy="140" r="10" fill="url(#armGradient)" />
          <g className="clipboard">
            <rect x="225" y="100" width="40" height="55" rx="4" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="2" />
            <rect x="232" y="112" width="26" height="9" fill="#3B82F6" opacity="0.7" />
            <rect x="232" y="126" width="26" height="7" fill="#3B82F6" opacity="0.5" />
            <rect x="232" y="137" width="26" height="7" fill="#3B82F6" opacity="0.5" />
            <circle cx="246" cy="107" r="3" fill="#EC4899" />
          </g>
        </g>
        <rect x="125" y="95" width="30" height="15" rx="7" fill="url(#neckGradient)" />
        <circle cx="140" cy="60" r="40" fill="url(#headGradient)" className="robot-head" />
        <rect x="105" y="35" width="70" height="15" rx="7" fill="rgba(255,255,255,0.15)" />
        <g className="robot-eye-left">
          <circle cx="120" cy="55" r="12" fill="#06B6D4" className="eye-outer" />
          <circle cx="120" cy="55" r="8" fill="#0891B2" />
          <circle cx="120" cy="55" r="5" fill="#00D9FF" className="eye-glow" />
          <circle cx="122" cy="53" r="2" fill="#fff" />
        </g>
        <g className="robot-eye-right">
          <circle cx="160" cy="55" r="12" fill="#06B6D4" className="eye-outer" />
          <circle cx="160" cy="55" r="8" fill="#0891B2" />
          <circle cx="160" cy="55" r="5" fill="#00D9FF" className="eye-glow" />
          <circle cx="162" cy="53" r="2" fill="#fff" />
        </g>
        <g className="antenna-left">
          <line x1="110" y1="20" x2="105" y2="0" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="105" cy="0" r="5" fill="#EC4899" />
        </g>
        <g className="antenna-right">
          <line x1="170" y1="20" x2="175" y2="0" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="175" cy="0" r="5" fill="#EC4899" />
        </g>
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" /></linearGradient>
          <linearGradient id="headGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" /></linearGradient>
          <linearGradient id="armGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" /></linearGradient>
          <linearGradient id="legGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0891B2" /><stop offset="100%" stopColor="#06B6D4" /></linearGradient>
          <linearGradient id="neckGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#0891B2" /></linearGradient>
        </defs>
      </svg>
      <div className="robot-text">Thống kê đang chạy...</div>
    </div>
  )
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [stats, setStats] = useState(null)

  // ====== BỘ LỌC (giống Seller) ======
  const presetOptions = [
    { key: "7days", label: "7 ngày qua", days: 7 },
    { key: "30days", label: "30 ngày qua", days: 30 },
    { key: "3months", label: "3 tháng qua", days: 90 },
    { key: "year", label: "Năm nay" },
  ]

  const defaultApplied = useMemo(() => {
    const end = todayYmd()
    const startD = new Date()
    startD.setDate(startD.getDate() - (7 - 1))
    return { startDate: toYMD(startD), endDate: end }
  }, [])

  const [selectedPreset, setSelectedPreset] = useState("7days")
  const [draftRange, setDraftRange] = useState({ startDate: "", endDate: "" })
  const [appliedRange, setAppliedRange] = useState(defaultApplied)

  const onClickPreset = (key) => {
    setSelectedPreset(key)
    const end = todayYmd()
    let range
    if (key === "year") {
      const start = toYMD(new Date(new Date().getFullYear(), 0, 1))
      range = { startDate: start, endDate: end }
    } else {
      const days = presetOptions.find((p) => p.key === key)?.days ?? 7
      const startD = new Date()
      startD.setDate(startD.getDate() - (days - 1))
      range = { startDate: toYMD(startD), endDate: end }
    }
    setAppliedRange(range) // áp dụng NGAY
  }

  const onChangeStart = (v) => setDraftRange({ startDate: v, endDate: "" })
  const onChangeEnd = (v) => setDraftRange((r) => ({ ...r, endDate: v }))
  const canApplyCustom = Boolean(draftRange.startDate && draftRange.endDate)
  const applyCustom = () => {
    if (!canApplyCustom) return
    if (new Date(draftRange.endDate) < new Date(draftRange.startDate)) {
      alert("Khoảng ngày không hợp lệ: 'Đến ngày' phải ≥ 'Từ ngày'.")
      return
    }
    setAppliedRange({ ...draftRange })
    setSelectedPreset("") // bỏ chọn preset khi dùng custom
  }

  // id -> shopName
  const [sellerMap, setSellerMap] = useState({})
  const nameCacheRef = useState(() => new Map())[0] // cache trong phiên

  const ctx = useContext(AuthContext)
  const authFetch = ctx?.authFetch
  const isAuthenticated = ctx?.isAuthenticated
  const logout = ctx?.logout

  /* ==== fetch helper ==== */
  const rawFetch = async (input, init = {}) => {
    if (authFetch) return authFetch(input, init)
    const headers = new Headers(init.headers || {})
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null
    if (token) headers.set("Authorization", `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  /* ===== mở rộng các field tên có thể có ===== */
  const pickName = (obj) =>
    obj?.shop_name ||
    obj?.shopName ||
    obj?.seller_name ||
    obj?.sellerName ||
    obj?.display_name ||
    obj?.displayName ||
    obj?.fullName ||
    obj?.name ||
    ""

  const getSellerName = (sellerId, hintObj) => {
    const hintName = pickName(hintObj)
    if (hintName) return hintName
    const key = String(sellerId ?? "")
    const m = sellerMap?.[key]
    return m && String(m).trim() ? m : key || "—"
  }

  const fetchSellerNameById = useCallback(async (id) => {
    if (!id) return ""
    if (nameCacheRef.has(id)) return nameCacheRef.get(id)

    const configured = API_CONFIG?.endpoints?.searchSellerBySellerId
      ? apiUrl(API_CONFIG.endpoints.searchSellerBySellerId(id))
      : null

    const candidates = [configured, apiUrl(`/info/sellers/${id}`)].filter(Boolean)

    for (const url of candidates) {
      try {
        const rs = await rawFetch(url, { headers: { Accept: "application/json" } })
        const j = await rs.json().catch(() => ({}))
        const payload = j?.result ?? j
        const name = pickName(payload)
        if (name) {
          nameCacheRef.set(id, name)
          return name
        }
      } catch {/* ignore */}
    }
    nameCacheRef.set(id, "")
    return ""
  }, [nameCacheRef]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== load số liệu theo bộ lọc ===== */
  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        setLoading(true)
        setErr("")

        if (ctx && !isAuthenticated) {
          setLoading(false)
          setErr("Bạn cần đăng nhập quản trị.")
          return
        }

        // build URL với startDate & endDate
        const base = apiUrl(API_CONFIG.endpoints.adminOrders.statisticsAdmin)
        const url = new URL(base)
        if (appliedRange?.startDate) url.searchParams.set("startDate", appliedRange.startDate)
        if (appliedRange?.endDate) url.searchParams.set("endDate", appliedRange.endDate)

        const res = await rawFetch(url.toString(), { headers: { Accept: "application/json" } })
        const json = await res.json().catch(() => ({}))
        if (res.status === 401 || json?.code === 1401) {
          if (logout) logout()
          throw new Error("Phiên đăng nhập đã hết hạn hoặc không hợp lệ.")
        }
        if (!res.ok || json?.code !== 200) throw new Error(json?.message || `HTTP ${res.status}`)
        if (abort) return

        const result = json.result || null
        setStats(result)

        // Enrich tên sellers
        const list = result?.topSellers || []
        const pairs = await Promise.all(
          list.map(async (s) => {
            const sid = String(s.sellerId)
            const itemName = pickName(s)
            if (itemName) return [sid, itemName]
            const fetched = await fetchSellerNameById(sid)
            return [sid, fetched || sid]
          }),
        )
        if (!abort) setSellerMap(Object.fromEntries(pairs))
      } catch (e) {
        if (!abort) {
          setErr(e.message || "Lỗi tải dữ liệu")
          setStats(null)
        }
      } finally {
        if (!abort) setLoading(false)
      }
    })()
    return () => { abort = true }
  }, [ctx, isAuthenticated, appliedRange, fetchSellerNameById]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== lấp tên còn thiếu nếu topSellers thay đổi ===== */
  useEffect(() => {
    if (!Array.isArray(stats?.topSellers) || !stats.topSellers.length) return
    const need = stats.topSellers
      .map((s) => String(s.sellerId))
      .filter((id) => {
        const item = stats.topSellers.find((x) => String(x.sellerId) === id)
        const hint = pickName(item)
        const mapped = sellerMap?.[id]
        return !(hint || (mapped && String(mapped).trim()))
      })

    if (need.length === 0) return

    let aborted = false
    ;(async () => {
      const pairs = await Promise.all(
        need.map(async (id) => {
          const name = await fetchSellerNameById(id)
          return [id, name || id]
        }),
      )
      if (!aborted) {
        setSellerMap((old) => ({ ...(old || {}), ...Object.fromEntries(pairs) }))
      }
    })()
    return () => { aborted = true }
  }, [stats?.topSellers, fetchSellerNameById]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== Derive data for charts/tables ===== */
  const revChart = stats?.platformRevenueChart || []
  const ordersDist = stats?.orderDistribution || {}
  const ordersByStatusRaw = ordersDist?.ordersByStatus || null
  const topSellers = stats?.topSellers || []
  const overview = stats?.platformOverview || {}

  // ---- Line chart geometry ----
  const chartW = 860, chartH = 320, padL = 60, padT = 20, padB = 40, padR = 20
  const maxRevenue = Math.max(1, ...revChart.map((d) => Number(d.revenue || 0)))
  const yTicks = useMemo(() => {
    const steps = 5
    const arr = []
    for (let i = 0; i <= steps; i++) arr.push(Math.round(maxRevenue * (i / steps)))
    return arr
  }, [maxRevenue])

  const xStep = revChart.length > 1 ? (chartW - padL - padR) / (revChart.length - 1) : 0
  const points = revChart.map((d, idx) => {
    const x = padL + idx * xStep
    const ratio = maxRevenue ? Number(d.revenue || 0) / maxRevenue : 0
    const y = padT + (chartH - padT - padB) * (1 - ratio)
    return { x, y, raw: d }
  })
  const pathD = smoothPath(points)

  const [hover, setHover] = useState(null)
  const onMouseMove = (evt) => {
    if (!revChart.length) return
    const rect = evt.currentTarget.getBoundingClientRect()
    const x = evt.clientX - rect.left
    let best = null, bestDist = Number.POSITIVE_INFINITY
    for (const p of points) {
      const dx = Math.abs(p.x - x)
      if (dx < bestDist) { best = p; bestDist = dx }
    }
    setHover(best)
  }

  // ---- Donut data (có thêm confirmed) ----
  const donutData = useMemo(() => {
    const mapping = [
      { key: "pending",   label: "Chờ xử lý",   color: "#F59E0B" },
      { key: "confirmed", label: "Đã xác nhận", color: "#A855F7" },
      { key: "shipping",  label: "Đang giao",   color: "#3B82F6" },
      { key: "completed", label: "Hoàn tất",    color: "#10B981" },
      { key: "cancelled", label: "Hủy",         color: "#EF4444" },
    ]
    const total = mapping.reduce((s, m) => s + Number(ordersDist[m.key] || 0), 0)
    let acc = 0
    const arcs = mapping.map((m) => {
      const val = Number(ordersDist[m.key] || 0)
      const pct = total ? val / total : 0
      const start = acc
      const end = acc + pct
      acc = end
      return { ...m, value: val, pct, start, end }
    })
    return { total, arcs }
  }, [ordersDist])

  // ---- Bar chart: Orders by Status ----
  const statusMap = {
    PENDING:   { label: "Chờ xử lý",   color: "#F59E0B" },
    CONFIRMED: { label: "Đã xác nhận", color: "#A855F7" },
    SHIPPED:   { label: "Đang giao",   color: "#3B82F6" },
    DELIVERED: { label: "Hoàn tất",    color: "#10B981" },
    CANCELLED: { label: "Hủy",         color: "#EF4444" },
  }

  const ordersByStatusArr = useMemo(() => {
    const src = ordersByStatusRaw || {
      CANCELLED: ordersDist.cancelled || 0,
      DELIVERED: ordersDist.completed || 0,
      CONFIRMED: ordersDist.confirmed || 0,
      PENDING: ordersDist.pending || 0,
      SHIPPED: ordersDist.shipping || 0,
    }
    return Object.entries(statusMap).map(([code, meta]) => ({
      code,
      label: meta.label,
      color: meta.color,
      value: Number(src[code] || 0),
    }))
  }, [ordersByStatusRaw, ordersDist])

  const barMax = Math.max(1, ...ordersByStatusArr.map((x) => x.value))
  const barChart = { w: 860, h: 280, padX: 60, padY: 30, gap: 28, barW: 60 }

  // ---- Top sellers progress max ----
  const topBarMax = Math.max(1, ...topSellers.map((s) => Number(s.totalRevenue || 0)))

  // ====== Filter title ======
  const presetLabel = presetOptions.find((p) => p.key === selectedPreset)?.label
  const filterTitle = selectedPreset
    ? presetLabel
    : `Từ ngày ${appliedRange.startDate} đến ${appliedRange.endDate}`

  return (
    <>
      {/* ==== FILTER BAR (preset + custom) ==== */}
      <div className="be-filters-wrap">
        <div className="be-filters">
          {presetOptions.map((p) => (
            <button
              key={p.key}
              className={`be-chip ${selectedPreset === p.key ? "is-active" : ""}`}
              onClick={() => onClickPreset(p.key)}
              title={p.label}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}

          <div className="be-datepick">
            <label>Từ ngày</label>
            <input
              type="date"
              value={draftRange.startDate}
              onChange={(e) => onChangeStart(e.target.value)}
              max={draftRange.endDate || todayYmd()}
              disabled={loading}
            />
          </div>
          <div className="be-datepick">
            <label>Đến ngày</label>
            <input
              type="date"
              value={draftRange.endDate}
              onChange={(e) => onChangeEnd(e.target.value)}
              min={draftRange.startDate || ""}
              max={todayYmd()}
              disabled={loading}
            />
          </div>

          <button
            className="be-icon-btn"
            onClick={applyCustom}
            disabled={!canApplyCustom || loading}
            title="Áp dụng bộ lọc"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="be-note-inline">Trạng thái lọc: <b>{filterTitle}</b></div>
      </div>

      {/* KPIs */}
      <CRow className="mb-4">
        {[
          { title: "Tổng doanh số", value: fmtMoney(stats?.platformOverview?.totalGMV), barColor: "primary", icon: "📊" },
          { title: "Hoa hồng nền tảng", value: fmtMoney(stats?.platformOverview?.totalCommission), barColor: "info", icon: "💰" },
          { title: "Tổng đơn", value: fmtNumber(stats?.platformOverview?.totalOrders), barColor: "success", icon: "📦" },
          { title: "Người bán hoạt động", value: fmtNumber(stats?.platformOverview?.activeSellers), barColor: "warning", icon: "🧑‍💼" },
        ].map((kpi, i) => (
          <CCol sm={6} lg={3} key={i} className="d-flex">
            <CCard className="mb-3 flex-fill kpi-card card-elevated h-100 kpi-hover">
              <CCardBody className="d-flex flex-column">
                <div className="kpi-icon">{kpi.icon}</div>
                <div className="text-body-secondary small kpi-title">{kpi.title}</div>
                <div className="fs-3 fw-bold mt-2 kpi-value">{kpi.value}</div>
                <div className="flex-grow-1" />
                <CProgress className="mt-3 progress-gradient" thin color={kpi.barColor} value={100} />
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Chart + Donut */}
      <CRow className="mb-4 align-items-stretch">
        {/* Line chart */}
        <CCol lg={8} className="d-flex">
          <CCard className="mb-3 flex-fill card-elevated h-100 chart-card">
            <CCardHeader className="d-flex justify-content-between align-items-center chart-header">
              <div className="fw-bold">Doanh thu nền tảng theo ngày</div>
              <CButton size="sm" color="primary" className="btn-export" disabled={loading}>
                <CIcon icon={cilCloudDownload} />
                &nbsp;Xuất
              </CButton>
            </CCardHeader>
            <CCardBody className="chart-body">
              {loading ? (
                <div className="skeleton skeleton-chart" />
              ) : err ? (
                <div className="text-danger">{err}</div>
              ) : (
                <div className="chart-container">
                  <svg width={860} height={320} onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopOpacity="0.4" stopColor="#6366F1" />
                        <stop offset="100%" stopOpacity="0.02" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width={860} height={320} fill="transparent" />

                    {yTicks.map((val, i) => {
                      const y = padT + (chartH - padT - padB) * (1 - (maxRevenue ? val / maxRevenue : 0))
                      return (
                        <g key={i}>
                          <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="4 4" />
                          <text x={padL - 8} y={y + 4} fontSize="11" textAnchor="end" fill="#6B7280">
                            {fmtMoney(val)}
                          </text>
                        </g>
                      )
                    })}

                    {points.map((p, i) => {
                      const step = Math.ceil(points.length / 8) || 1
                      const show = i % step === 0 || i === points.length - 1
                      if (!show) return null
                      return (
                        <text key={"x" + i} x={p.x} y={chartH - 12} fontSize="11" textAnchor="middle" fill="#6B7280">
                          {fmtDateVN(p.raw.date)}
                        </text>
                      )
                    })}

                    {points.length > 1 && (
                      <path
                        d={`M ${padL} ${chartH - padB} ` + (smoothPath(points) || "") + ` L ${points[points.length - 1]?.x ?? padL} ${chartH - padB} Z`}
                        fill="url(#revGradient)"
                      />
                    )}

                    <path d={smoothPath(points)} fill="none" stroke="#6366F1" strokeWidth="3" className="chart-line" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366F1" className="chart-point" />
                    ))}

                    {hover && (
                      <>
                        <line x1={hover.x} x2={hover.x} y1={padT} y2={chartH - padB} stroke="#94A3B8" strokeDasharray="4 4" />
                        <circle cx={hover.x} cy={hover.y} r="6" fill="#fff" stroke="#6366F1" strokeWidth="2" />
                      </>
                    )}
                  </svg>

                  {hover && (
                    <div className="chart-tooltip">
                      <div className="fw-semibold">{fmtDateVN(hover.raw.date)}</div>
                      <div>Doanh thu: <strong>{fmtMoney(hover.raw.revenue)}</strong></div>
                      <div>Đơn hàng: <strong>{fmtNumber(hover.raw.orderCount)}</strong></div>
                    </div>
                  )}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Donut chart */}
        <CCol lg={4} className="d-flex">
          <CCard className="mb-3 flex-fill card-elevated h-100 donut-card">
            <CCardHeader className="fw-bold donut-header">Phân bố trạng thái đơn</CCardHeader>
            <CCardBody className="d-flex flex-column align-items-center justify-content-center">
              {loading ? (
                <div className="skeleton skeleton-donut" />
              ) : (
                <>
                  <svg width="260" height="260" viewBox="0 0 42 42" className="donut-svg">
                    <circle cx="21" cy="21" r="15.915" fill="#fff" />
                    {donutData.arcs.map((a) => {
                      const c = 2 * Math.PI * 15.915
                      const dash = a.pct * c
                      const gap = c - dash
                      const rot = -90 + 360 * a.start
                      return (
                        <circle
                          key={a.key}
                          cx="21"
                          cy="21"
                          r="15.915"
                          fill="transparent"
                          stroke={a.color}
                          strokeWidth="6"
                          strokeDasharray={`${dash} ${gap}`}
                          transform={`rotate(${rot} 21 21)`}
                          className="donut-seg"
                        />
                      )
                    })}
                    <circle cx="21" cy="21" r="10" fill="#fff" />
                    <text x="21" y="19.5" dominantBaseline="middle" textAnchor="middle" fontSize="5" fill="#111827" fontWeight="600">
                      {fmtNumber(donutData.total)}
                    </text>
                    <text x="21" y="24.5" dominantBaseline="middle" textAnchor="middle" fontSize="3.2" fill="#6B7280">
                      tổng đơn
                    </text>
                  </svg>

                  <div className="w-100 mt-3">
                    {donutData.arcs.map((a) => (
                      <div key={a.key} className="d-flex align-items-center justify-content-between mb-2 legend-row legend-hover">
                        <div className="d-flex align-items-center">
                          <span className="legend-dot" style={{ background: a.color }} />
                          <span>{a.label}</span>
                        </div>
                        <span className="text-body-secondary">
                          {fmtNumber(a.value)} ({fmtPercent(a.pct * 100)})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* NEW: Bar chart Orders by Status */}
      <CRow className="mb-4">
        <CCol lg={12} className="d-flex">
          <CCard className="mb-3 flex-fill card-elevated h-100 chart-card">
            <CCardHeader className="fw-bold table-header">Số đơn theo trạng thái</CCardHeader>
            <CCardBody className="chart-body be-barchart-body">
              {loading ? (
                <div className="skeleton skeleton-bars" />
              ) : (
                <div className="chart-container">
                  <svg width={barChart.w} height={barChart.h}>
                    <line
                      x1={barChart.padX}
                      y1={barChart.h - barChart.padY}
                      x2={barChart.w - barChart.padX / 2}
                      y2={barChart.h - barChart.padY}
                      stroke="#E5E7EB"
                    />
                    {ordersByStatusArr.map((it, i) => {
                      const baseX = barChart.padX + i * (barChart.barW + barChart.gap)
                      const maxH = barChart.h - barChart.padY - 40
                      const h = Math.round((Number(it.value) / barMax) * maxH)
                      const y = barChart.h - barChart.padY - h
                      return (
                        <g key={it.code} className="be-bar-item">
                          <rect
                            x={baseX}
                            y={y}
                            width={barChart.barW}
                            height={h}
                            rx="8"
                            fill={it.color}
                            className="be-bar-rect"
                          />
                          <text x={baseX + barChart.barW / 2} y={y - 6} fontSize="12" textAnchor="middle" fill="#111827" fontWeight="600">
                            {fmtNumber(it.value)}
                          </text>
                          <text
                            x={baseX + barChart.barW / 2}
                            y={barChart.h - barChart.padY + 16}
                            fontSize="12"
                            textAnchor="middle"
                            fill="#6B7280"
                          >
                            {it.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Top người bán (progress + link) */}
      <CRow className="mb-4">
        <CCol lg={12} className="d-flex">
          <CCard className="mb-3 flex-fill card-elevated h-100 sellers-card">
            <CCardHeader className="fw-bold sellers-header">Top người bán theo doanh thu</CCardHeader>
            <CCardBody>
              {loading ? (
                <div className="skeleton skeleton-bars" />
              ) : (topSellers || []).length === 0 ? (
                <div>Chưa có dữ liệu.</div>
              ) : (
                <div className="p-1">
                  {topSellers.map((s, idx) => {
                    const name = getSellerName(s.sellerId, s)
                    const pct = Math.max(0, Math.min(100, (Number(s.totalRevenue || 0) / (Math.max(1, ...topSellers.map(x => Number(x.totalRevenue || 0))))) * 100))
                    return (
                      <div key={s.sellerId} className="mb-3 seller-item">
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <div className="fw-semibold seller-rank">#{idx + 1}</div>
                          <div className="fw-semibold seller-name text-truncate">
                            <Link
                              to={`/theme/seller/${s.sellerId}`}
                              className="seller-link"
                              title={`Xem người bán: ${name}`}
                            >
                              {name}
                            </Link>
                          </div>
                          <div className="text-body-secondary seller-revenue">{fmtMoney(s.totalRevenue)}</div>
                        </div>
                        <CProgress value={pct} color="primary" className="mt-2 progress-gradient progress-seller" />
                        <div className="small text-body-secondary mt-1">
                          Đơn: {fmtNumber(s.totalOrders)} · Tỉ lệ hoàn tất: {fmtPercent(s.completionRate)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Bảng chi tiết Top người bán */}
      <CRow className="mb-4">
        <CCol lg={12} className="d-flex">
          <CCard className="mb-3 flex-fill card-elevated h-100 table-card">
            <CCardHeader className="fw-bold table-header">Chi tiết Top người bán</CCardHeader>
            <CCardBody style={{ overflowX: "auto" }}>
              {loading ? (
                <div className="skeleton skeleton-table" />
              ) : (
                <CTable small hover responsive className="table-tight">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>Người bán</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Doanh thu</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Đơn</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Hoàn tất</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(topSellers || []).map((s, i) => {
                      const name = getSellerName(s.sellerId, s)
                      return (
                        <CTableRow key={s.sellerId} className="table-row-hover">
                          <CTableDataCell>{i + 1}</CTableDataCell>
                          <CTableDataCell style={{ maxWidth: 240 }} className="text-truncate">
                            <Link
                              to={`/theme/seller/${s.sellerId}`}
                              className="seller-link"
                              title={`Xem người bán: ${name}`}
                            >
                              {name}
                            </Link>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">{fmtMoney(s.totalRevenue)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmtNumber(s.totalOrders)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmtPercent(s.completionRate)}</CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <div className="mt-5 mb-4">
        <AnimatedRobot />
      </div>
    </>
  )
}
