import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from 'src/contexts/AuthContext'
import { apiUrl } from 'src/config/api'
import '../../theme/listseller/sellers-bw.css'

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
} from '@coreui/react'

/* === Icons (giữ Eye, bỏ Trash) === */
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M21 21l-4.3-4.3m1.3-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
      fill="none"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
const IconClear = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M18 6 6 18M6 6l12 12"
      fill="none"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)
const IconEye = () => (
  <svg className="view-ic-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const TABS = { APPROVED: 'APPROVED', REJECTED: 'REJECTED' }

const normalizeSeller = (r) => ({
  id: r.id,
  userId: r.user_id || r.userId,
  shopName: r.shop_name || r.shopName || '—',
  email: r.email || '—',
  avatar: r.avatar_link || r.avatarLink || null,
  address: r.address || '—',
  createdAt: r.registration_date || r.created_time || null,
  status: (r.status || 'UNKNOWN').toUpperCase(),
})

export default function ListSeller() {
  const { authFetch, isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  const [active, setActive] = useState(TABS.APPROVED)
  const [search, setSearch] = useState('')

  const [approved, setApproved] = useState([])
  const [rejected, setRejected] = useState([])

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Pagination
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  /* ===== Fetch all sellers ===== */
  const fetchAll = useCallback(async () => {
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
      const a = list.filter((s) => s.status === 'APPROVED')
      const r = list.filter((s) => s.status === 'REJECTED')
      setApproved(a)
      setRejected(r)
    } catch (e) {
      setErr(e.message || 'Không tải được danh sách.')
    } finally {
      setLoading(false)
    }
  }, [authFetch, isAuthenticated])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const list = active === TABS.APPROVED ? approved : rejected

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (s) =>
        (s.shopName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.address ?? '').toLowerCase().includes(q),
    )
  }, [list, search])

  // Reset về trang 1 khi đổi tab / từ khóa / pageSize
  useEffect(() => {
    setPage(1)
  }, [active, search, pageSize])

  /* ===== Pagination calc ===== */
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = useMemo(
    () => filtered.slice(start, start + pageSize),
    [filtered, start, pageSize],
  )
  const goPage = (p) => setPage(Math.min(totalPages, Math.max(1, p)))

  const renderPageButtons = () => {
    if (totalPages <= 1) return null
    const btns = []
    const win = 5
    let a = Math.max(1, page - Math.floor(win / 2))
    let b = Math.min(totalPages, a + win - 1)
    if (b - a + 1 < win) a = Math.max(1, b - win + 1)
    if (a > 1) {
      btns.push(
        <button key="p1" className="sp-pg-btn" onClick={() => goPage(1)}>
          1
        </button>,
      )
      if (a > 2)
        btns.push(
          <span key="dl" className="sp-pg-dots">
            …
          </span>,
        )
    }
    for (let i = a; i <= b; i++) {
      btns.push(
        <button
          key={i}
          className={`sp-pg-btn ${i === page ? 'active' : ''}`}
          onClick={() => goPage(i)}
        >
          {i}
        </button>,
      )
    }
    if (b < totalPages) {
      if (b < totalPages - 1)
        btns.push(
          <span key="dr" className="sp-pg-dots">
            …
          </span>,
        )
      btns.push(
        <button key="plast" className="sp-pg-btn" onClick={() => goPage(totalPages)}>
          {totalPages}
        </button>,
      )
    }
    return btns
  }

  return (
    <CCard className="bw-card fade-in">
      {/* Header */}
      <CCardHeader className="bw-header">
        <div className="bw-header-inner">
          <strong className="bw-title">Danh sách Seller</strong>

          <div className="header-actions">
            <div className="ls-tabs" role="tablist" aria-label="Trạng thái seller">
              <button
                className={`ls-tab ${active === TABS.APPROVED ? 'active' : ''}`}
                role="tab"
                aria-selected={active === TABS.APPROVED}
                onClick={() => setActive(TABS.APPROVED)}
              >
                ĐÃ DUYỆT
              </button>
              <button
                className={`ls-tab ${active === TABS.REJECTED ? 'active' : ''}`}
                role="tab"
                aria-selected={active === TABS.REJECTED}
                onClick={() => setActive(TABS.REJECTED)}
              >
                BỊ TỪ CHỐI
              </button>
            </div>

            <CInputGroup className="bw-ig bw-compact" size="sm">
              <CInputGroupText>
                <IconSearch />
              </CInputGroupText>
              <CFormInput
                placeholder="Tìm theo shop, email, địa chỉ…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <CInputGroupText role="button" onClick={() => setSearch('')}>
                  <IconClear />
                </CInputGroupText>
              )}
            </CInputGroup>
          </div>
        </div>
      </CCardHeader>

      {/* Body */}
      <CCardBody>
        {err && <div className="text-danger mb-2">{err}</div>}

        {loading ? (
          <div className="py-5 text-center">
            <CSpinner />
          </div>
        ) : (
          <>
            <CTable hover responsive className="bw-table">
              <colgroup>
                <col style={{ width: '64px' }} />
                <col style={{ width: '38%' }} />
                <col style={{ width: '44%' }} />
                <col style={{ width: '128px' }} />
              </colgroup>

              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>#</CTableHeaderCell>
                  <CTableHeaderCell>Tên shop</CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell className="text-center w-actions">Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {pageRows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={4} className="text-center py-4 text-muted">
                      Không có seller nào
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  pageRows.map((s, idx) => (
                    <CTableRow key={s.id} className="fade-in">
                      <CTableDataCell>{start + idx + 1}</CTableDataCell>

                      <CTableDataCell className="cell-shop">
                        <div className="shop-cell">
                          {s.avatar ? (
                            <img className="shop-avatar" src={s.avatar} alt="" />
                          ) : (
                            <div className="shop-avatar placeholder" aria-hidden>
                              🏪
                            </div>
                          )}
                          <div className="shop-meta">
                            <div className="shop-name">{s.shopName}</div>
                            <div className="shop-sub">{s.address || '—'}</div>
                          </div>
                        </div>
                      </CTableDataCell>

                      <CTableDataCell className="cell-email">{s.email}</CTableDataCell>

                      <CTableDataCell className="cell-actions">
                        <button
                          className="icon-btn"
                          onClick={() => navigate(`/theme/seller/${s.id}`)}
                          title="Xem chi tiết"
                          aria-label="Xem chi tiết"
                        >
                          <IconEye />
                        </button>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>

            {/* Pagination */}
            <div className="slr-pagination">
              <div className="slr-pg-left">
                Hiển thị <b>{pageRows.length}</b> / <b>{total}</b> seller
              </div>
              <div className="slr-pg-middle">
                <button
                  className="sp-pg-btn"
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1}
                  aria-label="Trang trước"
                >
                  ‹
                </button>
                {renderPageButtons()}
                <button
                  className="sp-pg-btn"
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  aria-label="Trang sau"
                >
                  ›
                </button>
              </div>
              <div className="slr-pg-right">
                <label>
                  Mỗi trang:
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <span className="pg-sep" />
                <span>
                  Trang {page}/{totalPages}
                </span>
              </div>
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}
