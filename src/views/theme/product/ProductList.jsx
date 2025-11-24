// src/views/theme/product/ProductList.jsx
import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormInput,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CBadge,
  CImage,
  CModal,
  CModalHeader,
  CModalBody,
  CModalTitle,
  CModalFooter,
  CButton,
} from '@coreui/react'
import { AuthContext } from 'src/contexts/AuthContext'
import { API_CONFIG, apiUrl } from 'src/config/api'
import './product-list.css'
import { showToast } from 'src/lib/toast-bus'
import { suspendWithEvidence } from 'src/services/suspend'

/* === Toast bus (an toàn khi import sớm) === */
const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : null),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

/* === Icons === */
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

/* Tam giác cảnh báo (đen dùng cho nút hành động trong bảng) */
const IconSuspend = () => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3L1 21h22L12 3z"
      fill="none"
      stroke="#111827"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 9v5" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.2" fill="#111827" />
  </svg>
)
/* Tam giác cảnh báo trắng (dùng trong nút chính của modal) */
const IconSuspendWhite = () => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3L1 21h22L12 3z"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 9v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.2" fill="#fff" />
  </svg>
)

/* ===== CSV export util ===== */
const toExcelCSV = (rows, header) => {
  const DELIM = ';'
  const EOL = '\r\n'
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = []
  if (header && header.length) lines.push(header.map(esc).join(DELIM))
  rows.forEach((r) => lines.push(r.map(esc).join(DELIM)))
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), lines.join(EOL)], {
    type: 'text/csv;charset=utf-8;',
  })
  return blob
}
const normalizeNumber = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : ''
}

/* ===== Violation options (label VN, value BE) ===== */
const VIOLATIONS = [
  { label: 'Hàng giả', value: 'FAKE_PRODUCT' },
  { label: 'Hàng cấm/trái phép', value: 'ILLEGAL_PRODUCT' },
  { label: 'Vi phạm chính sách', value: 'POLICY_VIOLATION' },
  { label: 'Khác', value: 'OTHER' },
]

export default function ProductList() {
  const { authFetch } = useContext(AuthContext)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [sellerMap, setSellerMap] = useState({})

  // search & pagination
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // modal xem chi tiết
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [mainImg, setMainImg] = useState(null)

  // ===== Modal tạm ngưng =====
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [targetProduct, setTargetProduct] = useState(null)
  const [suspendReason, setSuspendReason] = useState('Tạm ngưng do vi phạm')
  const [violType, setViolType] = useState('FAKE_PRODUCT')
  const [deleting, setDeleting] = useState(false)

  // file chọn + preview
  const fileInputRef = useRef(null)
  const [eviPreviews, setEviPreviews] = useState([]) // [{file, url}]

  /* ========== Data fetch ========== */
  const fetchSellers = async () => {
    try {
      const res = await authFetch(apiUrl('/info/sellers'), { method: 'GET' })
      const raw = await res.text()
      let data = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = { message: raw }
      }
      if (!res.ok || (data?.code && data.code !== 200))
        throw new Error(data?.message || `HTTP ${res.status}`)
      const list = Array.isArray(data?.result) ? data.result : []
      const map = {}
      list.forEach((r) => {
        if (r?.id) map[r.id] = r.shop_name || r.shopName || '—'
      })
      setSellerMap(map)
    } catch (e) {
      console.warn('Fetch sellers failed:', e?.message)
    }
  }

  const fetchProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(apiUrl(API_CONFIG.endpoints.products.getAll), { method: 'GET' })
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.result || [])
    } catch (e) {
      setError(e.message || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const refresh = useCallback(async () => {
    await Promise.all([fetchSellers(), fetchProducts()])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* ========== Helpers ========== */
  const getPrice = (p) => {
    const c = [
      p?.price,
      p?.salePrice,
      p?.basePrice,
      p?.prices?.current,
      p?.variants?.[0]?.price,
      p?.sizes?.[0]?.price,
    ].filter((x) => x !== undefined && x !== null)
    const v = c.length ? Number(c[0]) : null
    return v == null || Number.isNaN(v) ? null : v
  }
  const getStock = (p) => {
    if (p?.stock != null) return Number(p.stock)
    if (p?.quantity != null) return Number(p.quantity)
    if (p?.inventory != null) return Number(p.inventory)
    if (Array.isArray(p?.variants))
      return p.variants.reduce((s, v) => s + Number(v?.stock ?? v?.quantity ?? 0), 0)
    if (Array.isArray(p?.sizes))
      return p.sizes.reduce((s, v) => s + Number(v?.stock ?? v?.quantity ?? 0), 0)
    return null
  }
  const fmtPrice = (v) => (v === null ? '-' : Number(v).toLocaleString('vi-VN'))
  const renderStatus = (s) => {
    const v = (s || '').toLowerCase()
    const map = {
      active: 'success',
      available: 'success',
      inactive: 'secondary',
      draft: 'secondary',
      pending: 'warning',
      banned: 'danger',
      hidden: 'dark',
      soldout: 'info',
      outofstock: 'info',
    }
    const color = map[v] || 'primary'
    return (
      <CBadge color={color} className="text-uppercase">
        {s || 'N/A'}
      </CBadge>
    )
  }
  const normalizeImages = (p) =>
    Array.isArray(p?.images)
      ? p.images
          .map((it) => (typeof it === 'string' ? it : it?.url || it?.link || ''))
          .filter(Boolean)
      : []
  const getSellerName = (p) => p?.sellerName || sellerMap[p?.sellerId] || p?.sellerId || '—'
  const getSellerId = (p) => p?.sellerId || null

  /* ========== Filter & Pagination ========== */
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return products
    return products.filter((p) => {
      const key = `${p?.name || ''} ${p?.description || ''} ${p?.id || p?._id || ''}`.toLowerCase()
      return key.includes(t)
    })
  }, [products, q])

  useEffect(() => {
    setPage(1)
  }, [q, pageSize])
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)
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

  /* ========== View detail ========== */
  const onView = (p) => {
    setCurrent(p)
    const imgs = normalizeImages(p)
    setMainImg(imgs[0] || null)
    setOpen(true)
  }

  /* ========== Suspend flow ========== */
  const onClickSuspend = (p) => {
    setTargetProduct(p)
    setSuspendReason('Tạm ngưng do vi phạm')
    setViolType('FAKE_PRODUCT')
    setEviPreviews([]) // reset previews
    setSuspendModalOpen(true)
  }

  const handleOpenFileDialog = () => fileInputRef.current?.click()
  const handleEvidenceSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setEviPreviews((prev) => [...prev, ...next])
    // reset input để chọn lại trùng tên vẫn trigger
    e.target.value = ''
  }
  const removeEvidence = (idx) => {
    setEviPreviews((prev) => {
      const cp = [...prev]
      const [rm] = cp.splice(idx, 1)
      if (rm?.url) URL.revokeObjectURL(rm.url)
      return cp
    })
  }
  // cleanup urls khi đóng modal
  useEffect(() => {
    if (!suspendModalOpen) return
    return () => {
      setEviPreviews((prev) => {
        prev.forEach((p) => p?.url && URL.revokeObjectURL(p.url))
        return []
      })
    }
  }, [suspendModalOpen])

  const confirmSuspend = async () => {
    if (!targetProduct) return
    setDeleting(true)
    try {
      const pid = targetProduct?.id || targetProduct?._id
      const sellerId = getSellerId(targetProduct)
      const evidenceFiles = eviPreviews.map((p) => p.file)

      await suspendWithEvidence(authFetch, {
        productId: pid,
        sellerId,
        reason: suspendReason || 'Tạm ngưng do vi phạm',
        violationType: violType || 'FAKE_PRODUCT',
        description: suspendReason || 'Tạm ngưng do vi phạm', // mô tả cho chính report-violation
        evidenceFiles,
      })

      getToastAPI().show?.({ title: 'Đã tạm ngưng sản phẩm', type: 'success', duration: 2500 })
      setSuspendModalOpen(false)
      setTargetProduct(null)
      setSuspendReason('')
      setEviPreviews([])
      await fetchProducts()
    } catch (e) {
      getToastAPI().show?.({
        title: 'Tạm ngưng thất bại',
        text: e?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 3500,
      })
      await refresh()
    } finally {
      setDeleting(false)
    }
  }

  const cancelSuspend = () => {
    if (deleting) return
    setSuspendModalOpen(false)
    setTargetProduct(null)
  }

  /* ========== Export ========== */
  const onExportExcel = () => {
    const header = ['Tên sản phẩm', 'Giá', 'Trạng thái', 'Người bán', 'Tồn kho', 'ID']
    const rows = filtered.map((p) => {
      const rawPrice = getPrice(p)
      const stock = getStock(p)
      return [
        p?.name || '—',
        normalizeNumber(rawPrice),
        p?.status || '—',
        getSellerName(p),
        normalizeNumber(stock),
        p?.id || p?._id || '—',
      ]
    })
    const blob = toExcelCSV(rows, header)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `san-pham_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast?.({ title: 'Đã xuất Excel (CSV)', type: 'success', duration: 2000 })
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="pl-card fade-in">
          <CCardHeader className="pl-header">
            <div className="pl-header-inner">
              <strong className="pl-title">Tất cả sản phẩm</strong>
              <div className="pl-actions">
                <CFormInput
                  className="pl-ig pl-compact"
                  placeholder="Tìm theo tên, mô tả, ID…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="button"
                  className="pl-btn-excel sm"
                  onClick={onExportExcel}
                  title="Xuất Excel"
                >
                  <span className="xl-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M4 4h9a1 1 0 0 1 1 1v2h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H10l-6-.02A1 1 0 0 1 3 19V5a1 1 0 0 1 1-1zm10 5v10h4V9h-4zM6.6 8.6h1.8l1.6 2.8 1.6-2.8h1.8l-2.5 4 2.6 4H13l-1.6-2.9L9.8 16H8l2.6-4-2.6-3.4z"
                      />
                    </svg>
                  </span>
                  Xuất Excel
                </button>
              </div>
            </div>
          </CCardHeader>

          <CCardBody>
            {error && <div className="pl-error mb-2">{error}</div>}

            {loading ? (
              <div className="py-5 text-center">
                <CSpinner />
              </div>
            ) : (
              <>
                <CTable hover responsive className="pl-table">
                  <colgroup>
                    <col style={{ width: '64px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>

                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Ảnh</CTableHeaderCell>
                      <CTableHeaderCell>Tên sản phẩm</CTableHeaderCell>
                      <CTableHeaderCell>Giá</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Người bán</CTableHeaderCell>
                      <CTableHeaderCell>Tồn kho</CTableHeaderCell>
                      <CTableHeaderCell className="text-center w-actions">
                        Hành động
                      </CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>

                  <CTableBody>
                    {pageRows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={7} className="text-center py-4 text-muted">
                          Không có sản phẩm nào
                        </CTableDataCell>
                      </CTableRow>
                    ) : (
                      pageRows.map((p, idx) => {
                        const cover = normalizeImages(p)[0] || null
                        const price = getPrice(p)
                        const stock = getStock(p)
                        return (
                          <CTableRow key={p.id || p._id || `${start + idx}`} className="fade-in">
                            <CTableDataCell>
                              {cover ? (
                                <CImage
                                  src={cover}
                                  alt={p.name}
                                  width={48}
                                  height={48}
                                  style={{ objectFit: 'cover', borderRadius: 6 }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 6,
                                    background: '#eee',
                                  }}
                                />
                              )}
                            </CTableDataCell>

                            <CTableDataCell className="fw-medium">{p.name || '—'}</CTableDataCell>
                            <CTableDataCell>{fmtPrice(price)}</CTableDataCell>
                            <CTableDataCell>{renderStatus(p.status)}</CTableDataCell>
                            <CTableDataCell className="pl-ellipsis">
                              {getSellerId(p) ? (
                                <Link
                                  className="pl-link"
                                  to={`/theme/seller/${getSellerId(p)}`}
                                  title={`Xem người bán: ${getSellerName(p)}`}
                                >
                                  {getSellerName(p)}
                                </Link>
                              ) : (
                                getSellerName(p)
                              )}
                            </CTableDataCell>
                            <CTableDataCell>{stock == null ? '—' : stock}</CTableDataCell>

                            <CTableDataCell className="pl-actions-cell">
                              <button
                                className="pl-icon-btn"
                                onClick={() => onView(p)}
                                title="Xem chi tiết"
                                aria-label="Xem chi tiết"
                              >
                                <IconEye />
                              </button>
                              <button
                                className="pl-icon-btn danger"
                                onClick={() => onClickSuspend(p)}
                                title="Tạm ngưng sản phẩm"
                                aria-label="Tạm ngưng sản phẩm"
                              >
                                <IconSuspend />
                              </button>
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })
                    )}
                  </CTableBody>
                </CTable>

                {/* Pagination */}
                <div className="pl-pagination">
                  <div className="pl-pg-left">
                    Hiển thị <b>{pageRows.length}</b> / <b>{total}</b> sản phẩm
                  </div>
                  <div className="pl-pg-middle">
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
                  <div className="pl-pg-right">
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
      </CCol>

      {/* Modal xem chi tiết */}
      <CModal
        visible={open}
        onClose={() => setOpen(false)}
        alignment="center"
        size="lg"
        scrollable
        portal
        className="prod-modal"
      >
        <CModalHeader>
          <CModalTitle>{current?.name || 'Chi tiết sản phẩm'}</CModalTitle>
        </CModalHeader>
        <CModalBody className="prod-modal-body">
          <div className="pm-left">
            <div className="pm-mainimg">
              {mainImg ? (
                <img src={mainImg} alt="main" />
              ) : (
                <div className="pm-mainimg placeholder">No image</div>
              )}
            </div>
            <div className="pm-thumbs">
              {normalizeImages(current).map((url, i) => (
                <button
                  className="pm-thumb"
                  key={i}
                  type="button"
                  onClick={() => setMainImg(url)}
                  title="Xem ảnh"
                >
                  <img src={url} alt={`thumb-${i}`} />
                </button>
              ))}
              {normalizeImages(current).length === 0 && (
                <div className="pm-thumb placeholder">No image</div>
              )}
            </div>
          </div>
          <div className="pm-right">
            <div className="pm-row">
              <div className="pm-label">Giá</div>
              <div className="pm-value">{fmtPrice(getPrice(current))} đ</div>
            </div>
            <div className="pm-row">
              <div className="pm-label">Trạng thái</div>
              <div className="pm-value">{renderStatus(current?.status)}</div>
            </div>
            <div className="pm-row">
              <div className="pm-label">Người bán</div>
              <div className="pm-value">{getSellerName(current)}</div>
            </div>
            <div className="pm-row">
              <div className="pm-label">Tồn kho</div>
              <div className="pm-value">
                {(() => {
                  const s = getStock(current)
                  return s === null ? '—' : s
                })()}
              </div>
            </div>
            <div className="pm-row">
              <div className="pm-label">Mã sản phẩm</div>
              <div className="pm-value">{current?.id || current?._id}</div>
            </div>
            <div className="pm-row pm-row-full">
              <div className="pm-label">Mô tả</div>
              <div className="pm-value prod-desc">{current?.description || '—'}</div>
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal TẠM NGƯNG */}
      <CModal
        visible={suspendModalOpen}
        onClose={cancelSuspend}
        alignment="center"
        size="lg"
        scrollable
        className="susp-modal"
      >
        <CModalHeader className="susp-header">
          <CModalTitle>
            <span className="susp-icon">
              <IconSuspendWhite />
            </span>
            Tạm ngưng sản phẩm
          </CModalTitle>
        </CModalHeader>

        <CModalBody className="susp-body">
          <div className="susp-row">
            <div className="susp-label">Sản phẩm</div>
            <div className="susp-value">{targetProduct?.name || '—'}</div>
          </div>

          <div className="susp-row">
            <div className="susp-label">Lý do tạm ngưng</div>
            <div className="susp-value">
              <textarea
                className="pl-textarea susp-textarea"
                rows={3}
                placeholder="Ví dụ: Tạm ngưng do vi phạm…"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                disabled={deleting}
              />
            </div>
          </div>

          <div className="susp-row">
            <div className="susp-label">Loại vi phạm</div>
            <div className="susp-value">
              <select
                className="form-select susp-select"
                value={violType}
                onChange={(e) => setViolType(e.target.value)}
                disabled={deleting}
              >
                {VIOLATIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="susp-row">
            <div className="susp-label">Bằng chứng</div>
            <div className="susp-value">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden-file-input"
                onChange={handleEvidenceSelect}
                disabled={deleting}
              />
              <button
                type="button"
                className="btn choose-btn"
                onClick={handleOpenFileDialog}
                disabled={deleting}
              >
                Chọn ảnh chứng cứ
              </button>

              {eviPreviews.length > 0 && (
                <div className="evi-grid">
                  {eviPreviews.map((p, i) => (
                    <div className="evi-item" key={i}>
                      <img src={p.url} alt={`evi-${i}`} />
                      <button
                        type="button"
                        className="evi-remove"
                        title="Xóa ảnh"
                        onClick={() => removeEvidence(i)}
                        aria-label="Xóa ảnh"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="pl-hint mt-2">
                <small>
                  Gợi ý: Nhấn <b>Ctrl/⌘ + Enter</b> để xác nhận nhanh
                </small>
              </div>
            </div>
          </div>
        </CModalBody>

        <CModalFooter className="susp-footer">
          <CButton color="secondary" variant="outline" onClick={cancelSuspend} disabled={deleting}>
            Huỷ
          </CButton>
          <CButton
            color="dark"
            className="susp-submit"
            onClick={confirmSuspend}
            disabled={deleting}
            title="Tạm ngưng"
          >
            {deleting ? (
              'Đang xử lý…'
            ) : (
              <>
                <span className="ic-wrap">
                  <IconSuspendWhite />
                </span>
                Tạm ngưng
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
