import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilX } from '@coreui/icons'
import { AuthContext } from 'src/contexts/AuthContext'
import { listUsers } from 'src/services/adminUsers'
import '../../theme/user/users-bw.css'

// Tabs (giá trị nội bộ giữ nguyên để lọc)
const U_TABS = { AVAILABLE: 'AVAILABLE', DELETED: 'DELETED' }

export default function BrowseUsers() {
  const { authFetch, isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Tab đang chọn
  const [active, setActive] = useState(U_TABS.AVAILABLE)

  // Phân trang
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const reload = async () => {
    setLoading(true)
    setErr('')
    try {
      const data = await listUsers(authFetch)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setErr(e.message || 'Tải danh sách người dùng thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) reload()
  }, [isAuthenticated]) // eslint-disable-line

  // debounce tìm kiếm -> hiện đang refetch, nếu muốn chỉ lọc client thì xoá effect này
  useEffect(() => {
    const t = setTimeout(() => {
      if (isAuthenticated) reload()
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // reset về trang 1 khi đổi search/pageSize/tab
  useEffect(() => {
    setPage(1)
  }, [search, pageSize, active])

  /* ====== FILTER THEO TAB -> SEARCH -> PAGINATION ====== */
  // 1) Lọc theo tab
  const tabFiltered = useMemo(() => {
    const stat = (v) => String(v).toUpperCase()
    if (active === U_TABS.AVAILABLE) {
      return rows.filter((u) => stat(u?.status) === 'AVAILABLE' || u?.status === true)
    }
    // DELETED
    return rows.filter((u) => stat(u?.status) === 'DELETED')
  }, [rows, active])

  // 2) Tìm kiếm
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tabFiltered
    return tabFiltered.filter((u) => {
      const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.toLowerCase()
      const phone = (u?.phone ?? '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  }, [tabFiltered, search])

  // 3) Phân trang
  const total = searched.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = useMemo(
    () => searched.slice(start, start + pageSize),
    [searched, start, pageSize],
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

  /* ===== Badge trạng thái (VIỆT HOÁ) ===== */
  const statusBadge = (status) => {
    const s = String(status).toUpperCase()
    if (s === 'AVAILABLE' || status === true)
      return <CBadge className="bw-badge-available">Khả dụng</CBadge>
    if (s === 'DELETED') return <CBadge className="bw-badge-unavailable">Đã xoá</CBadge>
    if (s === 'UNAVAILABLE' || status === false)
      return <CBadge className="bw-badge-unavailable">Không khả dụng</CBadge>
    return <CBadge className="bw-badge-unknown">Không rõ</CBadge>
  }

  return (
    <CCard className="bw-card fade-in">
      <CCardHeader className="bw-header bw-header-tight">
        <div className="bw-header-bar">
          {/* Cụm TRÁI: Tiêu đề + Tabs */}
          <div className="bw-left">
            <strong className="bw-title no-wrap">Quản lý người dùng</strong>
          </div>

          {/* Cụm PHẢI: Tìm kiếm */}
          <div className="bw-right">
            <CInputGroup className="bw-ig bw-compact header-search" size="sm">
              <CInputGroupText>
                <CIcon icon={cilSearch} />
              </CInputGroupText>
              <CFormInput
                placeholder="Tìm theo họ tên hoặc SĐT…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Tìm theo họ tên hoặc số điện thoại"
              />
              {search && (
                <CInputGroupText role="button" onClick={() => setSearch('')} title="Xoá từ khoá">
                  <CIcon icon={cilX} />
                </CInputGroupText>
              )}
            </CInputGroup>
          </div>
        </div>
      </CCardHeader>

      <CCardBody>
        {err && <div className="text-danger mb-2">{err}</div>}

        {loading ? (
          <div className="py-5 text-center">
            <CSpinner />
          </div>
        ) : (
          <>
            <CTable hover responsive className="bw-table">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 220 }}>ID</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên</CTableHeaderCell>
                  <CTableHeaderCell>SĐT</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {pageRows.map((u) => {
                  const id = u.id
                  const fullName = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim()
                  return (
                    <CTableRow key={id} className="fade-in">
                      <CTableDataCell
                        title={id}
                        style={{
                          maxWidth: 220,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {id}
                      </CTableDataCell>
                      <CTableDataCell>{fullName || '—'}</CTableDataCell>
                      <CTableDataCell>{u?.phone ?? '—'}</CTableDataCell>
                      <CTableDataCell>{statusBadge(u?.status)}</CTableDataCell>
                      <CTableDataCell>
                        <div className="row-actions">
                          <button
                            className="view-icon-btn"
                            onClick={() => navigate(`/users/${id}`)}
                            title="Xem chi tiết"
                            aria-label="Xem chi tiết"
                          >
                            <svg
                              className="view-ic-eye"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
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
                          </button>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
                {!pageRows.length && (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center py-4 text-muted">
                      Không có dữ liệu
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            {/* Phân trang */}
            <div className="usr-pagination">
              <div className="usr-pg-left">
                Hiển thị <b>{pageRows.length}</b> / <b>{total}</b> người dùng
              </div>
              <div className="usr-pg-middle">
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
              <div className="usr-pg-right">
                <label>
                  Mỗi trang:
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                    aria-label="Số bản ghi mỗi trang"
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
