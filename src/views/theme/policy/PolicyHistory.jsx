// src/pages/policy/PolicyHistory.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol,
  CFormInput, CFormLabel, CRow, CSpinner
} from '@coreui/react'
import { AuthContext } from 'src/contexts/AuthContext'
import { API_CONFIG, apiUrl } from 'src/config/api'
import dayjs from 'dayjs'
import './PolicyHistory.css'

/** ==== Cấu hình ==== */
const POLICY_CODE = 'seller-tos'
const PAGE_SIZE_OPTIONS = [5, 10, 20]

/** Ghép base URL (hỗ trợ cả apiUrl dạng function hoặc string) */
const makeUrl = (path) => {
  if (typeof apiUrl === 'function') return apiUrl(path)
  const base = (typeof apiUrl === 'string' && apiUrl) ? apiUrl : (API_CONFIG?.baseUrl || '')
  return `${base}${path}`
}

/** Header phụ (Authorization đã do authFetch gắn) */
const buildExtraHeaders = (userId) => {
  const h = { 'Content-Type': 'application/json' }
  if (userId) h['X-User-Id'] = userId
  return h
}

/** API: lấy toàn bộ versions */
const fetchVersions = async (authFetch, userId) => {
  const url = makeUrl(`/policy/policies/${POLICY_CODE}/versions`)
  const res = await authFetch(url, { headers: buildExtraHeaders(userId) })
  if (res.status === 401) throw new Error('UNAUTH')
  if (!res.ok) throw new Error('Fetch versions failed')
  return res.json()
}

/** Safe access helpers */
const nz = (v, d = '') => (v == null ? d : v)
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const PolicyHistory = () => {
  const { authFetch, isAuthenticated, user, logout } = useContext(AuthContext) || {}
  const currentUserId = user?.id || 'admin_001'

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const [versions, setVersions] = useState([]) // raw từ BE
  const [q, setQ] = useState('')               // search
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('effectiveFrom') // effectiveFrom | version
  const [sortDir, setSortDir] = useState('desc')        // asc | desc

  /** Load data */
  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !authFetch) {
          setErr('Bạn chưa đăng nhập hoặc phiên đã hết hạn.')
          setLoading(false)
          return
        }
        setLoading(true); setErr(''); setOk('')
        const data = await fetchVersions(authFetch, currentUserId)
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])
        setVersions(arr)
      } catch (e) {
        if (e?.message === 'UNAUTH') {
          setErr('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
          logout?.()
        } else {
          setErr('Không tải được lịch sử chính sách.')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuthenticated, authFetch, currentUserId, logout])

  /** Search + sort */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    let list = versions
    if (kw) {
      list = list.filter(v =>
        nz(v.version, '').toLowerCase().includes(kw) ||
        nz(v.changeNotes, '').toLowerCase().includes(kw) ||
        nz(v.contentMd, '').toLowerCase().includes(kw)
      )
    }
    const getKey = (it) => {
      if (sortBy === 'version') return nz(it.version, '')
      // mặc định: effectiveFrom/startDate
      return nz(it.effectiveFrom || it.startDate || '', '')
    }
    list = list.slice().sort((a, b) => {
      const ka = getKey(a); const kb = getKey(b)
      if (ka === kb) return 0
      if (sortDir === 'asc') return ka > kb ? 1 : -1
      return ka < kb ? 1 : -1
    })
    return list
  }, [versions, q, sortBy, sortDir])

  /** Phân trang */
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageItems = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize])

  /** Xác định “bản hiện hành” */
  const today = dayjs().format('YYYY-MM-DD')
  const isCurrent = (v) => {
    if (v.current === true) return true
    const candidates = versions
      .map(x => ({ x, ef: nz(x.effectiveFrom || x.startDate, '') }))
      .filter(it => it.ef && it.ef <= today)
      .sort((a, b) => (a.ef > b.ef ? -1 : 1))
    if (!candidates.length) return false
    return candidates[0].x?.version === v.version
  }

  /** Đổi sắp xếp */
  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  /** Format helpers */
  const fmtDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : '')
  const fmtPercent = (p) => (n(p) != null ? `${p}%` : '')

  /** Pagination buttons giống các trang trước */
  const goPage = (p) => setPage(Math.min(totalPages, Math.max(1, p)))
  const renderPageButtons = () => {
    if (totalPages <= 1) return null
    const btns = []
    const win = 5
    let a = Math.max(1, safePage - Math.floor(win / 2))
    let b = Math.min(totalPages, a + win - 1)
    if (b - a + 1 < win) a = Math.max(1, b - win + 1)

    if (a > 1) {
      btns.push(<button key="p1" className="ph-pg-btn" onClick={() => goPage(1)}>1</button>)
      if (a > 2) btns.push(<span key="dl" className="ph-pg-dots">…</span>)
    }
    for (let i = a; i <= b; i++) {
      btns.push(
        <button
          key={i}
          className={`ph-pg-btn ${i === safePage ? 'active' : ''}`}
          onClick={() => goPage(i)}
        >
          {i}
        </button>
      )
    }
    if (b < totalPages) {
      if (b < totalPages - 1) btns.push(<span key="dr" className="ph-pg-dots">…</span>)
      btns.push(
        <button key="plast" className="ph-pg-btn" onClick={() => goPage(totalPages)}>
          {totalPages}
        </button>
      )
    }
    return btns
  }

  const canPrev = safePage > 1 && !loading
  const canNext = safePage < totalPages && !loading

  return (
    <CRow className="policy-history-container">
      <CCol xs={12}>
        <CCard className="mb-4 policy-card">
          <CCardHeader className="d-flex justify-content-between align-items-center policy-header">
            <div className="d-flex align-items-center gap-3">
              <strong>Lịch sử chính sách • {POLICY_CODE}</strong>
              <CBadge color="secondary">{total} phiên bản</CBadge>
            </div>
            <div className="d-flex align-items-center gap-2">
              <CFormLabel htmlFor="search" className="mb-0 me-2">Tìm kiếm</CFormLabel>
              <CFormInput
                id="search"
                placeholder="Tìm theo version, ghi chú, nội dung…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }}
                style={{ width: 320 }}
              />
            </div>
          </CCardHeader>

          <CCardBody className="policy-body">
            {err && <CAlert color="danger" className="mb-3">{err}</CAlert>}
            {ok  && <CAlert color="success" className="mb-3">{ok}</CAlert>}

            {loading ? (
              <div className="py-5 text-center"><CSpinner /></div>
            ) : (
              <>
                <div className="table-responsive policy-history-table">
                  <table className="table table-hover">
                    <colgroup>
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '170px' }} />
                      <col style={{ width: '120px' }} />
                      <col />                      
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                    </colgroup>

                    <thead>
                      <tr>
                        <th className="ph-sort" onClick={() => toggleSort('version')}>
                          Version {sortBy === 'version' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="ph-sort" onClick={() => toggleSort('effectiveFrom')}>
                          Hiệu lực từ {sortBy === 'effectiveFrom' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th>Hoa hồng</th>
                        <th>Ghi chú</th>
                        <th className="text-center">PDF</th>
                        <th className="text-center">Trạng thái</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pageItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-body-secondary py-4">
                            Không có phiên bản nào.
                          </td>
                        </tr>
                      )}

                      {pageItems.map((v, idx) => (
                        <tr key={`${v.version}-${idx}`}>
                          <td className="fw-semibold cell-nowrap">{nz(v.version, '—')}</td>
                          <td className="cell-nowrap">{fmtDate(v.effectiveFrom || v.startDate)}</td>
                          <td className="cell-nowrap text-end">{fmtPercent(v.commissionPercent)}</td>
                          <td className="cell-ellipsis" title={nz(v.changeNotes, '')}>
                            {nz(v.changeNotes, '') || <span className="text-body-secondary">—</span>}
                          </td>
                          <td className="text-center">
                            {v.pdfUrl || v.pdfLink ? (
                              <a
                                href={v.pdfUrl || v.pdfLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-primary ph-btn"
                              >
                                Mở PDF
                              </a>
                            ) : (
                              <span className="text-body-secondary">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {isCurrent(v) ? (
                              <CBadge color="success" className="ph-badge">Hiện hành</CBadge>
                            ) : (
                              <CBadge color="secondary" className="ph-badge">Lịch sử</CBadge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phân trang kiểu đã dùng ở các trang trước */}
                <div className="ph-pagination">
                  <div className="ph-pg-left">
                    Hiển thị <b>{pageItems.length}</b> / <b>{total}</b> bản ghi
                  </div>

                  <div className="ph-pg-middle">
                    <button
                      className="ph-pg-btn"
                      onClick={() => goPage(safePage - 1)}
                      disabled={!canPrev}
                      aria-label="Trang trước"
                    >
                      ‹
                    </button>
                    {renderPageButtons()}
                    <button
                      className="ph-pg-btn"
                      onClick={() => goPage(safePage + 1)}
                      disabled={!canNext}
                      aria-label="Trang sau"
                    >
                      ›
                    </button>
                  </div>

                  <div className="ph-pg-right">
                    <label>
                      Mỗi trang:
                      <select
                        value={pageSize}
                        onChange={(e) => { setPage(1); setPageSize(Number(e.target.value) || 10) }}
                        style={{ marginLeft: 6 }}
                      >
                        {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <span className="ph-pg-sep" />
                    <span>
                      Trang {safePage}/{totalPages}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default PolicyHistory
