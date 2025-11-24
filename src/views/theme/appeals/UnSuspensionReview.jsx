import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from 'src/contexts/AuthContext'
import { apiUrl } from 'src/config/api'
import './un-suspension.css'

import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CInputGroup,
  CInputGroupText,
  CFormInput,
  CSpinner,
  CButton,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'
import { showToast } from 'src/lib/toast-bus'

/* ===== Toast bus helper ===== */
const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : showToast?.(opts)),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

/* ===== Inline SVG icons ===== */
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M21 21l-4.3-4.3m1.3-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
      fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconClear = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const IconEye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
      stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* Chuẩn hoá seller theo payload */
const normalizeSeller = (r) => ({
  id: r.id,
  userId: r.user_id || r.userId,
  shopName: r.shop_name || r.shopName || '—',
  email: r.email || '—',
  avatar: r.avatar_link || r.avatarLink || null,
  address: r.address || '—',
  createdAt: r.registration_date || r.created_time || null,
  status: (r.status || 'UNKNOWN').toUpperCase(),
  violationCount: r.violation_count ?? r.violationCount ?? null,
  suspendedAt: r.suspended_at ?? null,
})

export default function UnSuspensionReview() {
  const { authFetch, isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [rows, setRows] = useState([]) // chỉ giữ SUSPENDED sellers
  const [unsuspending, setUnsuspending] = useState({}) // {[id]: true|false}

  // Pagination
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  /* ===== Fetch sellers rồi lọc SUSPENDED ===== */
  const fetchSuspended = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setErr('')
    try {
      const res = await authFetch(apiUrl('/info/sellers'), { method: 'GET' })
      const raw = await res.text()
      let data = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = { message: raw }
      }

      if (res.status === 401) throw new Error('401 không được phép: token thiếu/hết hạn.')
      if (res.status === 403) throw new Error('403 cấm truy cập: không đủ quyền.')
      if (!res.ok || (data?.code && data.code !== 200)) {
        const msg = data?.message || data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }

      const list = Array.isArray(data?.result) ? data.result.map(normalizeSeller) : []
      setRows(list.filter((s) => s.status === 'SUSPENDED'))
    } catch (e) {
      setErr(e.message || 'Không tải được danh sách.')
      getToastAPI().show({
        title: 'Tải danh sách thất bại',
        text: e?.message,
        type: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }, [authFetch, isAuthenticated])

  useEffect(() => { fetchSuspended() }, [fetchSuspended])

  /* ===== Search + Pagination ===== */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (s) =>
        (s.shopName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.address ?? '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        (s.userId || '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize])

  useEffect(() => { setPage(1) }, [search, pageSize])

  const goPage = (p) => setPage(Math.min(totalPages, Math.max(1, p)))
  const renderPageButtons = () => {
    if (totalPages <= 1) return null
    const btns = []
    const win = 5
    let a = Math.max(1, page - Math.floor(win / 2))
    let b = Math.min(totalPages, a + win - 1)
    if (b - a + 1 < win) a = Math.max(1, b - win + 1)
    if (a > 1) {
      btns.push(<button key="p1" className="unsusp-pg-btn" onClick={() => goPage(1)}>1</button>)
      if (a > 2) btns.push(<span key="dl" className="unsusp-pg-dots">…</span>)
    }
    for (let i = a; i <= b; i++) {
      btns.push(
        <button key={i} className={`unsusp-pg-btn ${i === page ? 'active' : ''}`} onClick={() => goPage(i)}>
          {i}
        </button>
      )
    }
    if (b < totalPages) {
      if (b < totalPages - 1) btns.push(<span key="dr" className="unsusp-pg-dots">…</span>)
      btns.push(
        <button key="plast" className="unsusp-pg-btn" onClick={() => goPage(totalPages)}>
          {totalPages}
        </button>
      )
    }
    return btns
  }

  // Khóa nút mũi tên khi tổng kết quả < pageSize (vd < 10)
  const lockPager = total <= pageSize

  /* ===== Action: Gỡ tạm ngưng (có confirm + toast) ===== */
  const doUnsuspend = async (id) => {
    if (!id) return

    const { confirm, show } = getToastAPI()
    const ok = await confirm({
      title: 'Gỡ tạm ngưng?',
      text: 'Hệ thống sẽ mở lại trạng thái hoạt động cho seller này.',
      confirmText: 'Tiếp tục',
      cancelText: 'Huỷ',
      type: 'warning',
    })
    if (!ok) return

    setUnsuspending((m) => ({ ...m, [id]: true }))
    try {
      const res = await authFetch(apiUrl(`/info/sellers/unsuspend/${encodeURIComponent(id)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const raw = await res.text()
      let data = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = { message: raw } }
      if (!res.ok || (data?.code && data.code !== 200)) {
        const msg = data?.message || data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }

      setRows((prev) => prev.filter((s) => s.id !== id))
      show({ title: 'Đã gỡ tạm ngưng', type: 'success', duration: 2200 })
    } catch (e) {
      getToastAPI().show({
        title: 'Gỡ tạm ngưng thất bại',
        text: e?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setUnsuspending((m) => ({ ...m, [id]: false }))
    }
  }

  return (
    <CCard className="unsusp-card unsusp-fade-in">
      {/* Header */}
      <CCardHeader className="unsusp-header">
        <div className="unsusp-header-inner">
          <strong className="unsusp-title">Danh sách Seller bị tạm ngưng</strong>

          <div className="unsusp-actions">
            <CInputGroup className="unsusp-ig unsusp-compact" size="sm">
              <CInputGroupText><IconSearch /></CInputGroupText>
              <CFormInput
                placeholder="Tìm theo shop, email, địa chỉ, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Tìm kiếm"
              />
              {search && (
                <CInputGroupText role="button" onClick={() => setSearch('')} title="Xoá tìm kiếm">
                  <IconClear />
                </CInputGroupText>
              )}
            </CInputGroup>

            <CButton
              color="dark"
              size="sm"
              disabled={loading}
              onClick={fetchSuspended}
              title="Tải lại"
              aria-label="Tải lại"
            >
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="lg" />}
            </CButton>
          </div>
        </div>
      </CCardHeader>

      {/* Body */}
      <CCardBody>
        {err && <div className="text-danger mb-2">{err}</div>}

        {loading ? (
          <div className="py-5 text-center"><CSpinner /></div>
        ) : (
          <>
            {/* Bảng */}
            <CTable hover responsive className="unsusp-table unsusp-table--modern">
              <colgroup>
                <col style={{ width: '64px' }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '148px' }} />
              </colgroup>

              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>#</CTableHeaderCell>
                  <CTableHeaderCell>Tên shop</CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell>Bị tạm ngưng lúc</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {pageRows.length === 0 ? (
                  <CTableRow className="unsusp-row-empty">
                    <CTableDataCell colSpan={5}>
                      <div className="unsusp-empty">
                        <span className="ic">🗂️</span> Không có seller nào đang bị tạm ngưng
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  pageRows.map((s, idx) => {
                    const busy = !!unsuspending[s.id]
                    return (
                      <CTableRow key={s.id} className="unsusp-row">
                        <CTableDataCell className="unsusp-col-index">
                          {(page - 1) * pageSize + idx + 1}
                        </CTableDataCell>

                        <CTableDataCell className="unsusp-cell-shop">
                          <div className="unsusp-shop-cell">
                            {s.avatar ? (
                              <img className="unsusp-shop-avatar" src={s.avatar} alt="" />
                            ) : (
                              <div className="unsusp-shop-avatar placeholder" aria-hidden>🏪</div>
                            )}
                            <div className="unsusp-shop-meta">
                              <div className="unsusp-shop-name" title={s.shopName}>{s.shopName}</div>
                              <div className="unsusp-shop-sub" title={s.address || ''}>{s.address || '—'}</div>
                            </div>
                          </div>
                        </CTableDataCell>

                        <CTableDataCell className="unsusp-cell-email" title={s.email}>
                          {s.email}
                        </CTableDataCell>

                        <CTableDataCell className="unsusp-cell-muted">
                          {s.suspendedAt ? new Date(s.suspendedAt).toLocaleString('vi-VN') : '—'}
                        </CTableDataCell>

                        <CTableDataCell className="unsusp-cell-actions">
                          <div className="unsusp-actions-wrap">
                            <button
                              className="unsusp-icon-btn"
                              onClick={() => navigate(`/sellers/${s.id}`)}
                              title="Xem chi tiết" aria-label="Xem chi tiết"
                            >
                              <IconEye />
                            </button>

                            <CButton
                              color="primary"
                              className="btn-compact-32"
                              disabled={busy}
                              onClick={() => doUnsuspend(s.id)}
                              title="Gỡ tạm ngưng"
                            >
                              {busy ? <CSpinner size="sm" /> : 'Gỡ'}
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })
                )}
              </CTableBody>
            </CTable>

            {/* Pagination */}
            <div className="unsusp-pagination">
              <div className="unsusp-pg-left">
                Hiển thị <b>{pageRows.length}</b> / <b>{total}</b> seller
              </div>
              <div className="unsusp-pg-middle">
                <button
                  className="unsusp-pg-btn"
                  onClick={() => goPage(page - 1)}
                  disabled={lockPager || page <= 1}
                  aria-label="Trang trước"
                >
                  ‹
                </button>
                {renderPageButtons()}
                <button
                  className="unsusp-pg-btn"
                  onClick={() => goPage(page + 1)}
                  disabled={lockPager || page >= totalPages}
                  aria-label="Trang sau"
                >
                  ›
                </button>
              </div>
              <div className="unsusp-pg-right">
                <label>
                  Mỗi trang:
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                    style={{ marginLeft: 6 }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <span className="unsusp-pg-sep" />
                <span>Trang {page}/{totalPages}</span>
              </div>
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}
