'use client'

import React, { useEffect, useState, useCallback, useContext, useRef } from 'react'
import { AuthContext } from 'src/contexts/AuthContext'
import { apiUrl } from 'src/config/api'
import './withdraw-review.css'

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
  CFormSelect,
  CSpinner,
  CButton,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

/* ===== Toast bus helper (giống trang mẫu) ===== */
const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : (opts?.text || opts?.title) && alert(opts.text || opts.title)),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

/* ===== Helpers ===== */
const fmtMoney = (n) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(n) || 0)
const fmtDateTime = (iso) => {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso || ''
    return d.toLocaleString('vi-VN')
  } catch {
    return iso || ''
  }
}
const showStatus = (s = '') => {
  const t = String(s).toUpperCase()
  if (t === 'PENDING') return 'Chờ duyệt'
  if (t === 'APPROVED') return 'Đã duyệt'
  if (t === 'REJECTED') return 'Từ chối'
  return s
}

/* ===== Icons nhỏ ===== */
const IconEye = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ===== Build QR URL cho Sepay ===== */
/**
 * req: bản ghi rút tiền (active)
 * seller: thông tin shop (để ghép nội dung chuyển khoản)
 *
 * Sepay format:
 * https://qr.sepay.vn/img?acc=SO_TK&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG
 */
const buildSepayQrUrl = (req, seller) => {
  if (!req) return null

  const acc = (req.bankAccount || '').trim()
  if (!acc) return null

  // Nếu BE có trường bankCode (VCB, MB, ACB...) thì ưu tiên dùng; không thì tạm dùng bankName
  const rawBank = (req.bankCode || req.bankName || '').trim()
  if (!rawBank) return null

  const amount = Number(req.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const des =
    `Rut tien cho ${seller?.shop_name || 'seller'} - ID: ${req.id || ''}`.trim() ||
    `Rut tien ID: ${req.id || ''}`

  const qs = new URLSearchParams()
  qs.set('acc', acc)
  qs.set('bank', rawBank)              // nếu sau này bạn có mã riêng Sepay, chỉ cần đổi ở đây
  qs.set('amount', String(Math.round(amount)))
  qs.set('des', des)

  return `https://qr.sepay.vn/img?${qs.toString()}`
}

export default function WithdrawReview() {
  const { authFetch } = useContext(AuthContext)

  // Filter + phân trang (server-side)
  const [status, setStatus] = useState('PENDING') // PENDING | APPROVED | REJECTED | ALL
  const [page, setPage] = useState(0)             // 0-based (khớp API)
  const [size, setSize] = useState(10)

  // Data
  const [rows, setRows] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [seller, setSeller] = useState(null)

  // Actions
  const [acting, setActing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const rejectRef = useRef(null)

  /* ===== Fetch danh sách (server pagination) ===== */
  const loadList = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams()
      if (status && status !== 'ALL') qs.set('status', status)
      qs.set('page', String(page))
      qs.set('size', String(size))

      const url = apiUrl(`/payment/withdraw-requests?${qs.toString()}`)
      const res = await authFetch(url, { headers: { Accept: 'application/json' } })
      const raw = await res.text()
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const json = raw ? JSON.parse(raw) : {}
      const result = json.result ?? json

      setRows(Array.isArray(result?.content) ? result.content : [])
      setTotalPages(Number(result?.totalPages) || 0)
    } catch (e) {
      setRows([])
      setTotalPages(0)
      setErr(e?.message || 'Không tải được danh sách rút tiền')
      getToastAPI().show({
        title: 'Lỗi tải dữ liệu',
        text: e?.message,
        type: 'error',
        duration: 3200,
      })
    } finally {
      setLoading(false)
    }
  }, [authFetch, status, page, size])

  useEffect(() => { loadList() }, [loadList])

  /* ===== Mở modal & lấy seller ===== */
  const openModal = async (req) => {
    setActive(req)
    setSeller(null)
    setShowRejectBox(false)
    setRejectReason('')
    setOpen(true)

    if (req?.userId) {
      try {
        const url = apiUrl(`/info/sellers/searchByUserId/${encodeURIComponent(req.userId)}`)
        const res = await authFetch(url, { headers: { Accept: 'application/json' } })
        const raw = await res.text()
        if (res.ok) {
          const json = raw ? JSON.parse(raw) : {}
          setSeller(json.result ?? json ?? null)
        }
      } catch { /* ignore */ }
    }
  }

  /* ===== Duyệt ===== */
  const approve = async (id) => {
    if (!id) return
    setActing(true)
    try {
      const url = apiUrl(`/payment/withdraw-requests/${encodeURIComponent(id)}/approve`)
      const res = await authFetch(url, { method: 'PUT', headers: { Accept: 'application/json' } })
      const raw = await res.text()
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)

      await loadList()
      setOpen(false)
      setActive(null)
      setSeller(null)
      setShowRejectBox(false)
      setRejectReason('')

      getToastAPI().show({ title: 'Đã xử lý yêu cầu rút tiền', type: 'success', duration: 2200 })
    } catch (e) {
      getToastAPI().show({ title: ' cầu thất bại', text: e?.message, type: 'error', duration: 3200 })
    } finally {
      setActing(false)
    }
  }

  /* ===== Từ chối ===== */
  const rejectRequest = async (id) => {
    if (!id) return
    const r = rejectReason.trim()
    if (!r) {
      getToastAPI().show({ title: 'Thiếu lý do', text: 'Vui lòng nhập lý do từ chối.', type: 'warning', duration: 2400 })
      requestAnimationFrame(() => rejectRef.current?.focus())
      return
    }

    setRejecting(true)
    try {
      // Ưu tiên query param
      const url1 = apiUrl(`/payment/withdraw-requests/${encodeURIComponent(id)}/reject?reason=${encodeURIComponent(r)}`)
      let res = await authFetch(url1, { method: 'PUT', headers: { Accept: 'application/json' } })
      let raw = await res.text()

      // Fallback form-urlencoded
      if (!res.ok) {
        const url2 = apiUrl(`/payment/withdraw-requests/${encodeURIComponent(id)}/reject`)
        const body = new URLSearchParams({ reason: r })
        res = await authFetch(url2, {
          method: 'PUT',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
        })
        raw = await res.text()
        if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      }

      await loadList()
      setOpen(false)
      setActive(null)
      setSeller(null)
      setShowRejectBox(false)
      setRejectReason('')

      getToastAPI().show({ title: 'Đã từ chối yêu cầu rút tiền', type: 'success', duration: 2200 })
    } catch (e) {
      getToastAPI().show({ title: 'Từ chối yêu cầu thất bại', text: e?.message, type: 'error', duration: 3200 })
    } finally {
      setRejecting(false)
    }
  }

  /* ===== Pagination kiểu số + "…" (0-based) ===== */
  const goPage = (p0) => {
    const clamp = Math.max(0, Math.min(p0, Math.max(0, totalPages - 1)))
    setPage(clamp)
  }
  const renderPageButtons = () => {
    if (totalPages <= 1) return null
    const btns = []
    const win = 5
    let a = Math.max(0, page - Math.floor(win / 2))
    let b = Math.min(totalPages - 1, a + win - 1)
    if (b - a + 1 < win) a = Math.max(0, b - win + 1)

    if (a > 0) {
      btns.push(
        <button key="p1" className={`wd-pg-btn ${page === 0 ? 'active' : ''}`} onClick={() => goPage(0)} aria-label="Trang 1">
          1
        </button>,
      )
      if (a > 1) btns.push(<span key="dl" className="wd-pg-dots">…</span>)
    }
    for (let i = a; i <= b; i++) {
      btns.push(
        <button
          key={i}
          className={`wd-pg-btn ${i === page ? 'active' : ''}`}
          onClick={() => goPage(i)}
          aria-label={`Trang ${i + 1}`}
        >
          {i + 1}
        </button>,
      )
    }
    if (b < totalPages - 1) {
      if (b < totalPages - 2) btns.push(<span key="dr" className="wd-pg-dots">…</span>)
      btns.push(
        <button
          key="plast"
          className={`wd-pg-btn ${page === totalPages - 1 ? 'active' : ''}`}
          onClick={() => goPage(totalPages - 1)}
          aria-label={`Trang ${totalPages}`}
        >
          {totalPages}
        </button>,
      )
    }
    return btns
  }

  // ---- Lock nút mũi tên nếu < size (vd < 10) trên trang hiện tại
  const lockBySize = rows.length < size
  const canPrev = page > 0 && !loading && !lockBySize
  const canNext = totalPages > 0 && page < totalPages - 1 && !loading && !lockBySize

  const Badge = ({ kind }) => {
    const t = String(kind).toUpperCase()
    const bg = t === 'PENDING' ? '#fff7ed' : t === 'APPROVED' ? '#ecfdf5' : t === 'REJECTED' ? '#fef2f2' : '#eef2ff'
    const color = t === 'PENDING' ? '#c2410c' : t === 'APPROVED' ? '#047857' : t === 'REJECTED' ? '#b91c1c' : '#3730a3'
    return (
      <span className="wd-badge" style={{ background: bg, color }}>
        {showStatus(kind)}
      </span>
    )
  }

  // === QR URL cho yêu cầu đang mở ===
  const qrUrl = active ? buildSepayQrUrl(active, seller) : null

  return (
    <CCard className="wd-card wd-fade-in">
      {/* Header */}
      <CCardHeader className="wd-header">
        <div className="wd-header-inner">
          <strong className="wd-title">Duyệt yêu cầu rút tiền</strong>

          {/* Actions dồn phải: Filter trạng thái + Reload */}
          <div className="wd-actions">
            <CInputGroup className="wd-ig wd-compact" size="sm">
              <CInputGroupText className="wd-ig-label">Trạng thái</CInputGroupText>
              <CFormSelect
                value={status}
                onChange={(e) => {
                  setPage(0)
                  setStatus(e.target.value)
                }}
                aria-label="Lọc theo trạng thái"
              >
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
                <option value="ALL">Tất cả</option>
              </CFormSelect>
            </CInputGroup>

            <CButton color="dark" size="sm" disabled={loading} onClick={loadList} title="Tải lại" aria-label="Tải lại">
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="lg" />}
            </CButton>
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
            <CTable hover responsive className="wd-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>

              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Ngân hàng</CTableHeaderCell>
                  <CTableHeaderCell>Số tài khoản</CTableHeaderCell>
                  <CTableHeaderCell>Chủ tài khoản</CTableHeaderCell>
                  <CTableHeaderCell>Số tiền</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell className="text-center wd-w-actions">Xem</CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center py-4 text-muted">
                      Không có dữ liệu
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  rows.map((r) => (
                    <CTableRow key={r.id} className="wd-fade-in">
                      <CTableDataCell className="wd-cell-muted">{fmtDateTime(r.createdAt)}</CTableDataCell>
                      <CTableDataCell>{r.bankName || '—'}</CTableDataCell>
                      <CTableDataCell className="wd-cell-mono">{r.bankAccount || '—'}</CTableDataCell>
                      <CTableDataCell>{r.accountHolderName || '—'}</CTableDataCell>
                      <CTableDataCell className="wd-amount" style={{ fontWeight: 800 }}>{fmtMoney(r.amount)} đ</CTableDataCell>
                      <CTableDataCell className="wd-cell-status">
                        <Badge kind={r.status} />
                      </CTableDataCell>
                      <CTableDataCell className="wd-cell-actions">
                        <button className="wd-btn-view" onClick={() => openModal(r)} title="Xem chi tiết" aria-label="Xem chi tiết">
                          <IconEye />
                        </button>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>

            {/* Pagination */}
            <div className="wd-pagination">
              <div className="wd-pg-left">
                Trang <b>{totalPages === 0 ? 0 : page + 1}</b>/<b>{Math.max(1, totalPages)}</b>
              </div>

              <div className="wd-pg-middle">
                <button className="wd-pg-btn" onClick={() => goPage(page - 1)} disabled={!canPrev} aria-label="Trang trước">‹</button>
                {renderPageButtons()}
                <button className="wd-pg-btn" onClick={() => goPage(page + 1)} disabled={!canNext} aria-label="Trang sau">›</button>
              </div>

              <div className="wd-pg-right">
                <label>
                  Mỗi trang:
                  <select
                    value={size}
                    onChange={(e) => { setPage(0); setSize(Number(e.target.value) || 10) }}
                    style={{ marginLeft: 6 }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
            </div>
          </>
        )}
      </CCardBody>

      {/* Modal custom */}
      {open && (
        <div
          className="wd-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => { setOpen(false); setShowRejectBox(false); setRejectReason('') }}
        >
          <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-head">
              <div className="wd-modal-title">Chi tiết yêu cầu rút tiền</div>
              <button
                className="btn-plain"
                onClick={() => { setOpen(false); setShowRejectBox(false); setRejectReason('') }}
              >
                Đóng
              </button>
            </div>

            <div className="wd-modal-scroll">
              <div className="wd-modal-body">
                {/* Seller */}
                <div className="wd-seller">
                  <h4>Người dùng / Shop</h4>
                  {seller ? (
                    <>
                      <div className="wd-grid2" style={{ marginBottom: 8 }}>
                        <img
                          className="wd-avatar"
                          src={seller.avatar_link || 'https://placehold.co/72'}
                          alt="avatar"
                          onError={(e) => { e.currentTarget.src = 'https://placehold.co/72' }}
                        />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{seller.shop_name || '—'}</div>
                        </div>
                      </div>

                      <div className="row">
                        <strong>Địa chỉ:</strong>
                        <div className="wd-value">{seller.address || '—'}</div>
                      </div>

                      <div className="row">
                        <strong>Email:</strong>
                        <div className="wd-value">{seller.email || '—'}</div>
                      </div>

                      <div className="row">
                        <strong>User ID:</strong>
                        <div className="wd-value">{seller.user_id || active?.userId || '—'}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="wd-grid2" style={{ marginBottom: 8 }}>
                        <img className="wd-avatar" src="https://placehold.co/72" alt="avatar" />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 2 }}>Đang tải…</div>
                          <div style={{ color: '#6b7280' }}>—</div>
                        </div>
                      </div>
                      <div style={{ opacity: 0.7 }}>Không tìm thấy/đang tải thông tin người bán.</div>
                    </>
                  )}
                </div>

                {/* Request */}
                <div className="wd-req">
                  <h4>Thông tin yêu cầu</h4>
                  <div className="wd-kv"><div>Mã yêu cầu</div><div style={{ fontWeight: 700 }}>{active?.id || '—'}</div></div>
                  <div className="wd-kv"><div>Thời gian</div><div>{fmtDateTime(active?.createdAt)}</div></div>
                  <div className="wd-kv"><div>Trạng thái</div><div><b>{showStatus(active?.status)}</b></div></div>
                  <div className="wd-kv"><div>Ngân hàng</div><div>{active?.bankName || '—'}</div></div>
                  <div className="wd-kv"><div>Số tài khoản</div><div className="wd-cell-mono">{active?.bankAccount || '—'}</div></div>
                  <div className="wd-kv"><div>Chủ tài khoản</div><div>{active?.accountHolderName || '—'}</div></div>
                  <div className="wd-kv"><div>Số tiền</div><div style={{ fontWeight: 900 }}>{fmtMoney(active?.amount)} đ</div></div>
                  {active?.reason && <div className="wd-kv"><div>Lý do (nếu có)</div><div>{active.reason}</div></div>}

                  {/* QR chuyển khoản nhanh */}
                  {qrUrl && (
                    <div className="wd-qr-section">
                      <h5>Mã QR chuyển khoản</h5>
                      <p className="wd-qr-note">
                        Quét mã để chuyển đúng số tiền vào tài khoản của người bán.  
                        Vui lòng kiểm tra lại tên ngân hàng và số tài khoản trước khi chuyển.
                      </p>
                      <div className="wd-qr-box">
                        <img src={qrUrl} alt="QR chuyển khoản Sepay" className="wd-qr-img" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reject box */}
              {showRejectBox && String(active?.status).toUpperCase() === 'PENDING' && (
                <div className="wd-reject-box">
                  <h5>Lý do từ chối</h5>
                  <textarea
                    ref={rejectRef}
                    className="wd-textarea"
                    placeholder="Nhập lý do từ chối (bắt buộc)…"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="wd-foot">
              {showRejectBox ? (
                <>
                  <button
                    className="btn-plain"
                    disabled={rejecting}
                    onClick={() => { setShowRejectBox(false); setRejectReason('') }}
                  >
                    Hủy
                  </button>
                  <button
                    className="btn-reject"
                    disabled={rejecting || !rejectReason.trim()}
                    onClick={() => rejectRequest(active?.id)}
                    title={!rejectReason.trim() ? 'Nhập lý do trước khi từ chối' : ''}
                  >
                    {rejecting ? 'Đang từ chối…' : 'Xác nhận từ chối'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-plain"
                    onClick={() => { setOpen(false); setShowRejectBox(false); setRejectReason('') }}
                  >
                    Đóng
                  </button>
                  {String(active?.status).toUpperCase() === 'PENDING' && (
                    <>
                      <button className="btn-reject" disabled={acting || rejecting} onClick={() => setShowRejectBox(true)}>
                        Từ chối
                      </button>
                      <button className="btn-approve" disabled={acting || rejecting} onClick={() => approve(active.id)}>
                        {acting ? 'Đang xử lý…' : 'Xử lý'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </CCard>
  )
}
