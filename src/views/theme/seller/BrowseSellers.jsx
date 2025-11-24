import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../../styles/BrowseSellers.css'
import { AuthContext } from 'src/contexts/AuthContext'
import { listPendingSellers, verifySeller } from 'src/services/adminSellers'
import { showToast } from 'src/lib/toast-bus'

/* === Toast bus helper (fallback sang showToast nếu bus chưa có) === */
const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : showToast?.(opts)),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

/* Inline Eye Icon (monochrome) */
const IconEye = () => (
  <svg className="eye-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

/* Helper: lấy tên shop robust */
const pickName = (s) =>
  s?.shopName || s?.shop_name || s?.sellerName || s?.displayName || s?.fullName || s?.name || '—'

export default function BrowseSellers() {
  const { authFetch, isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState([]) // lưu id được chọn (xuyên trang)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // trạng thái submit duyệt/từ chối
  const [submitting, setSubmitting] = useState(false)

  // modal từ chối (áp dụng cho nhiều dòng)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // ========= Pagination =========
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  /* ===== Load danh sách ===== */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!isAuthenticated) return
      setLoading(true)
      setErr('')
      try {
        const data = await listPendingSellers(authFetch)
        if (mounted) setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        const msg = e.message || 'Không tải được danh sách.'
        if (mounted) setErr(msg)
        getToastAPI().show?.({ title: 'Lỗi tải danh sách', text: msg, type: 'error', duration: 3500 })
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [authFetch, isAuthenticated])

  /* ===== Filter ===== */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const src = rows || []
    if (!q) return src
    return src.filter(
      (s) =>
        pickName(s).toLowerCase().includes(q) ||
        String(s.email || '')
          .toLowerCase()
          .includes(q),
    )
  }, [rows, search])

  /* Reset page khi đổi list/search/size */
  useEffect(() => {
    setPage(1)
  }, [search, pageSize, rows])

  /* ===== Tính trang ===== */
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = useMemo(
    () => filtered.slice(start, start + pageSize),
    [filtered, start, pageSize],
  )

  /* ===== Select helpers (theo trang hiện tại) ===== */
  const pageIds = pageRows.map((s) => s.id)
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        // bỏ chọn tất cả của trang hiện tại
        return prev.filter((id) => !pageIds.includes(id))
      }
      // chọn thêm tất cả id ở trang hiện tại (tránh trùng)
      const merged = new Set(prev)
      pageIds.forEach((id) => merged.add(id))
      return Array.from(merged)
    })
  }

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /* ===== Hành động ===== */
  const approveSelected = async () => {
    if (!selected.length) {
      getToastAPI().show?.({
        title: 'Chưa chọn hồ sơ',
        text: 'Vui lòng chọn ít nhất 1 hồ sơ để duyệt.',
        type: 'warning',
        duration: 2500,
      })
      return
    }

    const ok = await getToastAPI().confirm({
      title: 'Duyệt hồ sơ',
      text: `Xác nhận duyệt ${selected.length} hồ sơ?`,
      confirmText: 'Duyệt',
      cancelText: 'Huỷ',
      type: 'info',
    })
    if (!ok) return

    try {
      setSubmitting(true)
      for (const id of selected) {
        await verifySeller(authFetch, { sellerId: id, status: 'APPROVED' })
      }
      // xoá các hàng đã xử lý khỏi danh sách
      setRows((prev) => prev.filter((r) => !selected.includes(r.id)))
      setSelected([])
      getToastAPI().show?.({
        title: 'Đã duyệt',
        text: 'Các hồ sơ đã được duyệt thành công.',
        type: 'success',
        duration: 2500,
      })
    } catch (e) {
      getToastAPI().show?.({
        title: 'Lỗi duyệt',
        text: e?.message || 'Không thể duyệt, vui lòng thử lại.',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openReject = () => {
    if (!selected.length) {
      getToastAPI().show?.({
        title: 'Chưa chọn hồ sơ',
        text: 'Chọn ít nhất 1 hồ sơ để từ chối.',
        type: 'warning',
        duration: 2500,
      })
      return
    }
    setRejectReason('')
    setShowRejectModal(true)
  }

  const submitReject = async () => {
    if (!selected.length) return

    const ok = await getToastAPI().confirm({
      title: 'Từ chối hồ sơ',
      text: `Xác nhận từ chối ${selected.length} hồ sơ?`,
      confirmText: 'Từ chối',
      cancelText: 'Huỷ',
      type: 'warning',
    })
    if (!ok) return

    try {
      setSubmitting(true)
      const reason = rejectReason?.trim()
      for (const id of selected) {
        const payload = { sellerId: id, status: 'REJECTED' }
        if (reason) payload.reason = reason
        await verifySeller(authFetch, payload)
      }
      setRows((prev) => prev.filter((r) => !selected.includes(r.id)))
      setSelected([])
      setShowRejectModal(false)
      getToastAPI().show?.({
        title: 'Đã từ chối',
        text: 'Các hồ sơ đã bị từ chối.',
        type: 'success',
        duration: 2500,
      })
    } catch (e) {
      getToastAPI().show?.({
        title: 'Lỗi từ chối',
        text: e?.message || 'Không thể từ chối, vui lòng thử lại.',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setSubmitting(false)
    }
  }

  /* ===== Page buttons (… rút gọn) ===== */
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
        <button key="p1" className="pg-btn" onClick={() => goPage(1)} aria-label="Trang 1">
          1
        </button>,
      )
      if (a > 2)
        btns.push(
          <span key="dl" className="pg-dots">
            …
          </span>,
        )
    }
    for (let i = a; i <= b; i++) {
      btns.push(
        <button
          key={i}
          className={`pg-btn ${i === page ? 'active' : ''}`}
          onClick={() => goPage(i)}
          aria-current={i === page ? 'page' : undefined}
        >
          {i}
        </button>,
      )
    }
    if (b < totalPages) {
      if (b < totalPages - 1)
        btns.push(
          <span key="dr" className="pg-dots">
            …
          </span>,
        )
      btns.push(
        <button
          key="plast"
          className="pg-btn"
          onClick={() => goPage(totalPages)}
          aria-label={`Trang ${totalPages}`}
        >
          {totalPages}
        </button>,
      )
    }
    return btns
  }

  return (
    <div className="browse-sellers">
      <div className="header-row">
        <h2>Danh sách Seller đang đợi duyệt</h2>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Tìm theo shop hoặc email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <button
            className="btn-mono red"
            onClick={openReject}
            disabled={submitting || selected.length === 0}
            title={selected.length === 0 ? 'Chọn dòng để từ chối' : 'Từ chối các hồ sơ đã chọn'}
          >
            Từ chối
          </button>
          <button
            className="btn-mono black"
            onClick={approveSelected}
            disabled={submitting || selected.length === 0}
            title={selected.length === 0 ? 'Chọn dòng để duyệt' : 'Duyệt các hồ sơ đã chọn'}
          >
            Duyệt
          </button>
        </div>
      </div>

      {err && <div className="error">{err}</div>}
      {loading ? (
        <div className="loading">Đang tải…</div>
      ) : (
        <>
          <table className="seller-table">
            <thead>
              <tr>
                <th className="w-check">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleSelectAll}
                    aria-label="Chọn tất cả (trang hiện tại)"
                  />
                </th>
                <th className="w-idx">#</th>
                <th>Shop</th>
                <th>Email</th>
                <th className="w-actions">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>
                    Không có seller nào
                  </td>
                </tr>
              ) : (
                pageRows.map((s, idx) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        aria-label={`Chọn seller ${pickName(s)}`}
                      />
                    </td>
                    <td>{start + idx + 1}</td>
                    <td className="text-truncate">{pickName(s)}</td>
                    <td className="text-truncate">{s.email || '—'}</td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn ghost"
                        onClick={() => navigate(`/sellers/${s.id}`)} // giữ NGUYÊN route cũ
                        title="Xem chi tiết"
                        aria-label="Xem chi tiết"
                      >
                        <IconEye />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="bs-pagination">
            <div className="pg-left">
              Hiển thị <b>{pageRows.length}</b> / <b>{total}</b> seller
            </div>
            <div className="pg-middle">
              <button
                className="pg-btn"
                onClick={() => goPage(page - 1)}
                disabled={page <= 1}
                aria-label="Trang trước"
              >
                ‹
              </button>
              {renderPageButtons()}
              <button
                className="pg-btn"
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Trang sau"
              >
                ›
              </button>
            </div>
            <div className="pg-right">
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

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="wk-modal-backdrop" role="dialog" aria-modal="true">
          <div className="wk-modal">
            <h3>Lý do từ chối</h3>
            <p style={{ margin: '6px 0 12px', color: '#666', fontSize: 14 }}>
              (Tuỳ chọn) Nhập lý do để người bán nhận được thông báo rõ ràng hơn.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
            />
            <div className="wk-modal-actions">
              <button
                className="btn-mono ghost"
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="btn-mono red"
                type="button"
                onClick={submitReject}
                disabled={submitting || selected.length === 0}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
