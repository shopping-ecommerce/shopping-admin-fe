// src/views/theme/product/ProductReviewQueue.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'
import { AuthContext } from 'src/contexts/AuthContext'
import { apiUrl } from 'src/config/api'
import { showToast } from 'src/lib/toast-bus'


/* ======================
   Toast bus helper (theo chuẩn trang mẫu)
   ====================== */
const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : showToast?.(opts)),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

/* ======================
   Base URL & Endpoints
   ====================== */
const URL_CATEGORIES = apiUrl('/product/categories')
const URL_PENDING = apiUrl('/product/pending')
const URL_APPROVE = (id) =>
  apiUrl(`/product/approve/${encodeURIComponent(id)}?status=AVAILABLE`)
const URL_REJECT = (id, reason) =>
  apiUrl(
    `/product/approve/${encodeURIComponent(id)}?status=DISCONTINUED&reason=${encodeURIComponent(
      reason || 'Vi phạm chính sách',
    )}`,
  )

/* ======================
   Helpers & styles
   ====================== */
const CATEGORY_I18N = {
  Electronics: 'Điện tử',
  Fashion: 'Thời trang',
  Books: 'Sách',
  Home: 'Nhà cửa',
  Sports: 'Thể thao',
  Beauty: 'Làm đẹp',
  Toys: 'Đồ chơi',
  Automotive: 'Ô tô - Xe máy',
  Health: 'Sức khỏe',
  Grocery: 'Tạp hóa',
  SecondHand: 'Đồ cũ',
  All: 'Tất cả',
}

const pickImage = (images = []) =>
  (images || [])
    .map((x) => (typeof x === 'string' ? x : x?.url))
    .find((u) => typeof u === 'string' && !u.toLowerCase().endsWith('.mp4')) || '/img/default.png'

const pickAllImages = (images = []) =>
  (images || [])
    .map((x) => (typeof x === 'string' ? x : x?.url))
    .filter((u) => typeof u === 'string' && !u.toLowerCase().endsWith('.mp4'))

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  } catch {
    return iso
  }
}

const pillCSS = `
  .prq-pill { display:inline-flex; align-items:center; gap:6px; font-size:12px;
    padding:6px 10px; border-radius:999px; font-weight:700; line-height:1;
    background:#fff8e1; color:#b26a00; border:1px solid #ffe7a3;
  }
  .prq-pill .dot { width:7px; height:7px; border-radius:50%; background:#ffb300 }
  .prq-eye-btn {
    width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center;
    border:1px solid #d1d5db; border-radius:10px; background:#fff; cursor:pointer;
    transition:transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
  }
  .prq-eye-btn:hover{ background:#f8fafc; border-color:#bfc6d1; box-shadow:0 6px 16px rgba(42,108,234,.15); transform: translateY(-1px); }
  .thumb-btn{
    border:1px solid #e5e7eb; border-radius:10px; width:72px; height:72px; overflow:hidden; flex:0 0 auto; background:#fff; cursor:pointer;
  }
  .thumb-btn.active{ border:2px solid #111 }
  .prq-qty{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;border-radius:6px;background:#f1f5f9;color:#0f172a;font-weight:700;padding:0 8px}
`

/* ======================
   Component
   ====================== */
const ProductReviewQueue = () => {
  const { authFetch } = useContext(AuthContext) || {}
  const toast = getToastAPI()

  // list state
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  // filters
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState([])
  const [catMap, setCatMap] = useState({})
  const [selectedCat, setSelectedCat] = useState('')

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [activeImg, setActiveImg] = useState(0)

  // reject flow
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('Vi phạm chính sách')
  const [acting, setActing] = useState(false)

  // ========== Load categories ==========
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(URL_CATEGORIES, { method: 'GET', headers: { Accept: 'application/json' } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
        const list = Array.isArray(data?.result) ? data.result : []
        if (!cancelled) {
          setCategories(list)
          const map = {}
          list.forEach((c) => (map[c.id] = c.name))
          setCatMap(map)
        }
      } catch (e) {
        if (!cancelled) {
          toast.show({
            title: 'Không tải được danh mục',
            text: e?.message,
            type: 'error',
            duration: 3200,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authFetch])

  // ========== Load pending products ==========
  const loadPending = async () => {
    setLoading(true)
    try {
      const res = await authFetch(URL_PENDING, { method: 'GET', headers: { Accept: 'application/json' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      setRows(Array.isArray(data?.result) ? data.result : [])
      toast.show({ title: 'Đã tải danh sách chờ duyệt', type: 'success', duration: 1200 })
    } catch (e) {
      setRows([])
      toast.show({
        title: 'Lỗi tải danh sách',
        text: e?.message || 'Không tải được danh sách cần duyệt.',
        type: 'error',
        duration: 3400,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ========== Derive list (search + filter) ==========
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((p) => {
      const nameOk = !q || String(p?.name || '').toLowerCase().includes(q)
      const catOk = !selectedCat || p.categoryId === selectedCat
      return nameOk && catOk
    })
  }, [rows, search, selectedCat])

  // ========== Actions ==========
  const openView = (p) => {
    setViewing(p)
    setActiveImg(0)
    setRejectMode(false) // reset mode mỗi lần mở
    setRejectReason('Vi phạm chính sách')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setRejectMode(false)
    setRejectReason('Vi phạm chính sách')
  }

  const doApprove = async () => {
    if (!viewing?.id) return
    setActing(true)
    try {
      const res = await authFetch(URL_APPROVE(viewing.id), { method: 'POST', headers: { Accept: 'application/json' } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      setRows((prev) => prev.filter((x) => x.id !== viewing.id))
      toast.show({ title: 'Đã phê duyệt sản phẩm', type: 'success', duration: 2200 })
      closeModal()
    } catch (e) {
      toast.show({ title: 'Phê duyệt thất bại', text: e?.message, type: 'error', duration: 3200 })
    } finally {
      setActing(false)
    }
  }

  const doReject = async () => {
    if (!viewing?.id) return
    setActing(true)
    try {
      const res = await authFetch(URL_REJECT(viewing.id, rejectReason), {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      setRows((prev) => prev.filter((x) => x.id !== viewing.id))
      toast.show({ title: 'Đã từ chối sản phẩm', type: 'success', duration: 2200 })
      closeModal()
    } catch (e) {
      toast.show({ title: 'Từ chối thất bại', text: e?.message, type: 'error', duration: 3200 })
    } finally {
      setActing(false)
    }
  }

  // ========== Render ==========
  return (
    <CRow>
      <style>{pillCSS}</style>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <strong>Duyệt sản phẩm</strong>
              <CBadge color="warning" shape="rounded-pill">
                {filtered.length}
              </CBadge>
            </div>

            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <input
                type="text"
                placeholder="Tìm theo tên…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  padding: '0 10px',
                  minWidth: 240,
                }}
              />
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                style={{ height: 34, borderRadius: 8, border: '1px solid #ddd', padding: '0 8px' }}
                title="Lọc theo danh mục"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {CATEGORY_I18N[c.name] || c.name}
                  </option>
                ))}
              </select>

              <CButton color="dark" size="sm" disabled={loading} onClick={loadPending} title="Tải lại" aria-label="Tải lại">
                {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="lg" />}
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" /> Đang tải dữ liệu…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted">Không có sản phẩm nào đang chờ duyệt.</div>
            ) : (
              <CTable align="middle" hover responsive>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell scope="col" style={{ width: 44 }}>
                      #
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col">Sản phẩm</CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 140 }}>
                      Danh mục
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 160 }}>
                      Ngày tạo
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 140 }}>
                      Trạng thái
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 90 }}>
                      Xem
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filtered.map((p, idx) => {
                    const thumb = pickImage(p.images)
                    const catEn = p?.categoryId ? catMap[p.categoryId] : ''
                    const catVi = CATEGORY_I18N[catEn] || catEn || '—'
                    return (
                      <CTableRow key={p.id}>
                        <CTableHeaderCell scope="row">{idx + 1}</CTableHeaderCell>
                        <CTableDataCell className="text-break">
                          <div className="d-flex align-items-center" style={{ gap: 10 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                                flex: '0 0 auto',
                              }}
                            >
                              <img
                                src={thumb}
                                alt={p.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{p.name}</div>
                              {p?.reUpdate && (
                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                  Người bán đã cập nhật lại (reUpdate)
                                </div>
                              )}
                            </div>
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>{catVi}</CTableDataCell>
                        <CTableDataCell>{fmtDate(p.createdAt)}</CTableDataCell>
                        <CTableDataCell>
                          <span className="prq-pill" title="Đang chờ duyệt">
                            <span className="dot" /> ĐỢI DUYỆT
                          </span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <button className="prq-eye-btn" onClick={() => openView(p)} title="Xem">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* ===================== Modal xem chi tiết & duyệt ===================== */}
      <CModal visible={modalOpen} onClose={closeModal} alignment="center" size="lg" scrollable>
        <CModalHeader>
          <CModalTitle>Chi tiết sản phẩm</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {!viewing ? (
            <div className="text-muted">Chưa chọn sản phẩm</div>
          ) : (
            <>
              {/* Header: Tên + badge */}
              <div className="d-flex align-items-start justify-content-between mb-2" style={{ gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>{viewing.name}</div>
                <span className="prq-pill">
                  <span className="dot" /> ĐỢI DUYỆT
                </span>
              </div>

              {/* Ảnh lớn */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  background: '#f7f7f7',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <img
                  src={
                    pickAllImages(viewing.images)[activeImg] ||
                    pickImage(viewing.images) ||
                    '/img/default.png'
                  }
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Thumbnails */}
              <div className="d-flex align-items-center mb-3" style={{ gap: 8, overflowX: 'auto' }}>
                {(pickAllImages(viewing.images).length
                  ? pickAllImages(viewing.images)
                  : [pickImage(viewing.images)]
                ).map((u, i) => (
                  <button
                    className={`thumb-btn ${i === activeImg ? 'active' : ''}`}
                    key={i}
                    onClick={() => setActiveImg(i)}
                    title={`Ảnh ${i + 1}`}
                  >
                    <img
                      src={u}
                      alt={`thumb-${i}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>

              {/* Meta grid */}
              <div
                className="mb-3"
                style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}
              >
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Danh mục</div>
                  <div style={{ fontWeight: 600 }}>
                    {CATEGORY_I18N[catMap[viewing.categoryId]] || catMap[viewing.categoryId] || '—'}
                  </div>
                </div>
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Ngày tạo</div>
                  <div style={{ fontWeight: 600 }}>{fmtDate(viewing.createdAt)}</div>
                </div>
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Đã bán / Lượt xem</div>
                  <div style={{ fontWeight: 600 }}>
                    {Number(viewing.soldCount || 0)} / {Number(viewing.viewCount || 0)}
                  </div>
                </div>
              </div>

              {/* Mô tả */}
              <div
                className="mb-3"
                style={{
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fcfcfc',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Mô tả</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {viewing.description || '—'}
                </div>
              </div>

              {/* Biến thể (nếu có) */}
              {Array.isArray(viewing.variants) && viewing.variants.length > 0 && (
                <div
                  className="mb-3"
                  style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Biến thể</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {viewing.variants.map((v, i) => {
                      const label = Object.entries(v?.options || {})
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' / ')
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,1fr) 120px 120px 90px',
                            gap: 8,
                            alignItems: 'center',
                            border: '1px solid #f1f5f9',
                            borderRadius: 10,
                            padding: 8,
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{label || '—'}</div>
                          <div>
                            Giá: <b>₫{Number(v?.price ?? 0).toLocaleString('vi-VN')}</b>
                          </div>
                          <div style={{ color: '#6b7280' }}>
                            So sánh:{' '}
                            {Number.isFinite(Number(v?.compareAtPrice)) ? (
                              <span style={{ textDecoration: 'line-through' }}>
                                ₫{Number(v?.compareAtPrice).toLocaleString('vi-VN')}
                              </span>
                            ) : (
                              '—'
                            )}
                          </div>
                          <div className="text-end">
                            <span className="prq-qty">{Number(v?.quantity ?? 0)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lý do từ chối (khi bật rejectMode) */}
              {rejectMode && (
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    Lý do từ chối (sẽ lưu vào lịch sử)
                  </div>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 10,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                    placeholder="Ví dụ: Vi phạm chính sách…"
                  />
                </div>
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          {/* Flow nút từ chối 2 bước */}
          {!rejectMode ? (
            <>
              <CButton color="danger" disabled={!viewing || acting} onClick={() => setRejectMode(true)}>
                Từ chối
              </CButton>
              <CButton color="dark" disabled={!viewing || acting} onClick={doApprove}>
                {acting ? <CSpinner size="sm" className="me-2" /> : null}
                Phê duyệt
              </CButton>
              <CButton color="secondary" variant="outline" onClick={closeModal}>
                Đóng
              </CButton>
            </>
          ) : (
            <>
              <CButton
                color="secondary"
                variant="outline"
                disabled={acting}
                onClick={() => setRejectMode(false)}
              >
                Huỷ
              </CButton>
              <CButton color="danger" disabled={!viewing || acting} onClick={doReject}>
                {acting ? <CSpinner size="sm" className="me-2" /> : null}
                Xác nhận từ chối
              </CButton>
              <CButton color="dark" disabled={acting} onClick={doApprove}>
                {acting ? <CSpinner size="sm" className="me-2" /> : null}
                Phê duyệt
              </CButton>
            </>
          )}
        </CModalFooter>
      </CModal>
    </CRow>
  )
}

export default ProductReviewQueue
