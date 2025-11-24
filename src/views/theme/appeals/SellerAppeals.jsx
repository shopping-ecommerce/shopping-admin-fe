// src/views/theme/appeals/SellerAppeals.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  CButton,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormTextarea,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'
import { showToast } from 'src/lib/toast-bus'

const getToastAPI = () => {
  const W = typeof window !== 'undefined' ? window : globalThis
  const bus = W.__appToastBus
  return {
    show: (opts) => (bus?.show ? bus.show(opts) : showToast?.(opts)),
    confirm: (opts) =>
      bus?.confirm ? bus.confirm(opts) : Promise.resolve(window.confirm(opts?.text || 'Xác nhận?')),
  }
}

const IconEye = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const safeJson = async (res) => {
  const text = await res.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text } }
}

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

const statusBadge = (s) => {
  const v = (s || '').toUpperCase()
  const map = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
  const color = map[v] || 'secondary'
  return <CBadge color={color}>{s || 'N/A'}</CBadge>
}

const pickAllImageUrls = (images = []) =>
  (Array.isArray(images) ? images : [])
    .map((it) => (typeof it === 'string' ? it : it?.url))
    .filter((u) => typeof u === 'string' && u && !u.toLowerCase().endsWith('.mp4'))

export default function SellerAppeals() {
  const { authFetch } = useContext(AuthContext) || {}

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [err, setErr] = useState('')

  const [viewOpen, setViewOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [current, setCurrent] = useState(null)
  const [adminResponse, setAdminResponse] = useState('')

  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [productDetail, setProductDetail] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)

  // Clamp/expand mô tả
  const [descExpanded, setDescExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const descRef = useRef(null)

  const columns = useMemo(
    () => [
      { key: 'id', label: 'Mã khiếu nại' },
      { key: 'seller', label: 'Người bán' },
      { key: 'reason', label: 'Lý do khiếu nại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'actions', label: 'Thao tác' },
    ],
    []
  )

  const fetchPending = async () => {
    setLoading(true)
    setErr('')
    try {
      const url = apiUrl('/info/appeals/pending')
      const res = await (authFetch ? authFetch(url) : fetch(url, { headers: { Accept: 'application/json' } }))
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
      const list = Array.isArray(data?.result) ? data.result : []
      setItems(list)
    } catch (e) {
      setItems([])
      setErr(e?.message || 'Không tải được danh sách khiếu nại')
      getToastAPI().show({ title: 'Lỗi', text: e?.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPending() }, [])

  const fetchProductById = async (productId) => {
    if (!productId) return null
    try {
      const url = apiUrl(`/product/searchByProduct/${encodeURIComponent(productId)}`)
      const res = await (authFetch
        ? authFetch(url, { headers: { Accept: 'application/json' } })
        : fetch(url, { headers: { Accept: 'application/json' } }))
      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json?.code && json.code !== 200)) throw new Error(json?.message || `HTTP ${res.status}`)
      const d = json?.result || {}
      const imgs = pickAllImageUrls(d?.images || [])
      return {
        id: d.id,
        sellerId: d.sellerId || d.seller_id || null,
        name: d.name || d.productName || '—',
        description: d.description || '',
        images: imgs.length ? imgs : ['/img/default.png'],
      }
    } catch { return null }
  }

  const openView = async (row) => {
    setCurrent(row)
    setAdminResponse('')
    setActiveIdx(0)
    setDescExpanded(false)
    setCanExpand(false)
    setViewOpen(true)

    setDetailLoading(true)
    setDetailError('')
    setProductDetail(null)
    try {
      const pid = row?.product_id || row?.productId
      const detail = await fetchProductById(pid)
      setProductDetail(detail)
    } catch (e) {
      setDetailError(e?.message || 'Không tải được thông tin sản phẩm')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeView = () => {
    setViewOpen(false)
    setCurrent(null)
    setProductDetail(null)
    setAdminResponse('')
    setActiveIdx(0)
    setDescExpanded(false)
    setCanExpand(false)
  }

  // Sau khi mô tả/expanded thay đổi → đo xem có tràn > 5 dòng không (chỉ hiện nút nếu dài quá)
  useEffect(() => {
    if (!viewOpen || !productDetail?.description || descExpanded) {
      // Khi đã mở full thì ẩn nút
      setCanExpand(false)
      return
    }
    const el = descRef.current
    if (!el) return
    // Đợi layout xong để đo
    const t = setTimeout(() => {
      try {
        const can = el.scrollHeight > el.clientHeight + 1 // nhỏ margin of error
        setCanExpand(can)
      } catch {
        setCanExpand(false)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [viewOpen, productDetail?.description, descExpanded])

  const submitReview = async (status) => {
    if (!current?.id) return
    const { confirm, show } = getToastAPI()
    const ok = await confirm({
      title: status === 'APPROVED' ? 'Duyệt khiếu nại?' : 'Từ chối khiếu nại?',
      text: status === 'APPROVED' ? 'Xác nhận duyệt khiếu nại này.' : 'Xác nhận từ chối khiếu nại.',
      confirmText: 'Xác nhận',
      cancelText: 'Huỷ',
      type: status === 'APPROVED' ? 'success' : 'danger',
    })
    if (!ok) return

    setProcessing(true)
    try {
      const url = apiUrl('/info/appeals/review')
      const body = JSON.stringify({ appeal_id: current.id, status, admin_response: adminResponse || null })
      const res = await (authFetch
        ? authFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        : fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)

      setItems((prev) => prev.filter((x) => x.id !== current.id))
      closeView()
      show({ title: status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối', type: 'success', duration: 2200 })
    } catch (e) {
      getToastAPI().show({ title: 'Thao tác thất bại', text: e?.message || 'Vui lòng thử lại.', type: 'error', duration: 3200 })
    } finally { setProcessing(false) }
  }

  return (
    <CCard className="unsusp-card unsusp-fade-in">
      <CCardHeader className="unsusp-header">
        <div className="unsusp-header-inner">
          <strong className="unsusp-title">Khiếu nại người bán (Chờ duyệt)</strong>
          <div className="unsusp-actions">
            <CButton color="dark" size="sm" disabled={loading} onClick={fetchPending} title="Tải lại" aria-label="Tải lại">
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="lg" />}
            </CButton>
          </div>
        </div>
      </CCardHeader>

      <CCardBody>
        {err && <div className="text-danger mb-2">{err}</div>}

        {loading ? (
          <div className="py-5 text-center"><CSpinner /></div>
        ) : (
          <CTable hover responsive className="unsusp-table">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <CTableHead>
              <CTableRow>
                {columns.map((c) => (<CTableHeaderCell key={c.key}>{c.label}</CTableHeaderCell>))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {items.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={columns.length} className="text-center py-4 text-muted">Không có khiếu nại chờ duyệt</CTableDataCell>
                </CTableRow>
              ) : (
                items.map((it) => (
                  <CTableRow key={it.id} className="unsusp-fade-in">
                    <CTableDataCell style={{ maxWidth: 280 }}>
                      <div className="text-truncate" title={it.id}>{it.id}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{it.seller_name || it.seller_id || '—'}</div>
                      <div className="text-muted small">{it.seller_email || '—'}</div>
                    </CTableDataCell>
                    <CTableDataCell style={{ maxWidth: 420 }}>
                      <div className="text-truncate" title={it.reason}>{it.reason || '—'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{statusBadge(it.status)}</CTableDataCell>
                    <CTableDataCell className="unsusp-cell-actions">
                      <button className="unsusp-btn-view" onClick={() => openView(it)} title="Xem chi tiết" aria-label="Xem chi tiết">
                        <IconEye />
                      </button>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        )}
      </CCardBody>

      <CModal visible={viewOpen} onClose={processing ? undefined : closeView} alignment="center" size="lg">
        <CModalHeader>
          <CModalTitle>Chi tiết khiếu nại</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detailLoading ? (
            <div className="d-flex align-items-center gap-2"><CSpinner size="sm" /> Đang tải chi tiết…</div>
          ) : detailError ? (
            <CAlert color="danger">{detailError}</CAlert>
          ) : current ? (
            <>
              {/* Header: product + appeal meta (dark cards) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <div style={{ background: '#111', color: '#fff', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>Sản phẩm</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.2)', flex: '0 0 auto' }}>
                      <img src={(productDetail?.images && productDetail.images[0]) || '/img/default.png'} alt={productDetail?.name || 'Sản phẩm'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>{productDetail?.name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Mã SP: {current.product_id || current.productId || '—'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#111', color: '#fff', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>Thông tin khiếu nại</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                    <div>Mã khiếu nại: {current.id}</div>
                    <div>Người bán: {current.seller_name || current.seller_id || '—'}</div>
                    <div className="mt-1">Trạng thái: <span style={{ marginLeft: 6 }}>{statusBadge(current.status)}</span></div>
                    <div className="mt-1">Gửi lúc: {fmtDateTime(current.submitted_at)}</div>
                  </div>
                </div>
              </div>

              {/* Gallery */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, marginTop: 12 }}>
                <div style={{ width: '100%', aspectRatio: '16/10', background: '#f7f7f7', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={(productDetail?.images && productDetail.images[activeIdx]) || (productDetail?.images && productDetail.images[0]) || '/img/default.png'}
                    alt="Xem trước"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {(productDetail?.images || ['/img/default.png']).map((u, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      style={{ border: i === activeIdx ? '2px solid #111' : '1px solid #ddd', borderRadius: 10, padding: 0, width: 72, height: 72, overflow: 'hidden', background: '#fff', cursor: 'pointer', flex: '0 0 auto' }}
                      title={`Ảnh ${i + 1}`}
                    >
                      <img src={u} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* MÔ TẢ lên trước, LÝ DO xuống sau */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, marginTop: 12 }}>
                {/* Mô tả sản phẩm (clamp 5 dòng). NÚT ở phía dưới KHÔNG nằm trong khối này */}
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fcfcfc' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Mô tả sản phẩm</div>
                  <div
                    ref={descRef}
                    style={
                      descExpanded
                        ? { whiteSpace: 'pre-wrap', lineHeight: 1.45 }
                        : {
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 5,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }
                    }
                  >
                    {productDetail?.description || '—'}
                  </div>
                </div>

                {/* Nút “Hiển thị đầy đủ” – chỉ xuất hiện nếu thật sự dài quá 5 dòng; căn giữa và NẰM DƯỚI phần mô tả */}
                {canExpand && !descExpanded && (
                  <div style={{ textAlign: 'center', marginTop: -4 }}>
                    <button
                      type="button"
                      onClick={() => setDescExpanded(true)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 10,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Hiển thị đầy đủ mô tả"
                    >
                      Hiển thị đầy đủ
                    </button>
                  </div>
                )}

                {/* Lý do khiếu nại */}
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Lý do khiếu nại</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{current.reason || '—'}</div>
                </div>

                {/* Ảnh minh chứng */}
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Ảnh minh chứng</div>
                  {Array.isArray(current.evidence_urls) && current.evidence_urls.length > 0 ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {current.evidence_urls.map((u, i) => (
                        <button
                          key={i}
                          onClick={() => { setLightboxIdx(i); setLightboxOpen(true) }}
                          style={{ width: 96, height: 96, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', padding: 0, cursor: 'pointer' }}
                          title={`Minh chứng ${i + 1}`}
                        >
                          <img src={u} alt={`evi-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted">—</div>
                  )}
                </div>

                {/* Phản hồi admin */}
                <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Phản hồi của admin (tuỳ chọn)</div>
                  <CFormTextarea rows={3} placeholder="Nhập phản hồi cho người bán…" value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} disabled={processing} />
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted">Không có dữ liệu</div>
          )}
        </CModalBody>

        {/* Footer: Đóng | Từ chối (đỏ nền, chữ đen) | Duyệt (đen nền, chữ trắng) */}
        <CModalFooter className="justify-content-end">
          <CButton color="secondary" variant="outline" onClick={closeView} disabled={processing} style={{ marginRight: 8 }}>
            Đóng
          </CButton>
          <CButton
            onClick={() => submitReview('REJECTED')}
            disabled={processing || !current}
            style={{ backgroundColor: '#ef4444', color: '#111', borderColor: '#ef4444', marginRight: 8 }}
            title="Từ chối khiếu nại"
          >
            {processing ? <CSpinner size="sm" className="me-2" /> : null}
            Từ chối
          </CButton>
          <CButton
            onClick={() => submitReview('APPROVED')}
            disabled={processing || !current}
            style={{ backgroundColor: '#111', color: '#fff', borderColor: '#111' }}
            title="Duyệt khiếu nại"
          >
            {processing ? <CSpinner size="sm" className="me-2" /> : null}
            Duyệt
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Lightbox evidence */}
      <CModal visible={lightboxOpen} onClose={() => setLightboxOpen(false)} alignment="center" size="lg">
        <CModalHeader><CModalTitle>Ảnh minh chứng</CModalTitle></CModalHeader>
        <CModalBody>
          {current?.evidence_urls?.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={current.evidence_urls[lightboxIdx]} alt="evidence" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                {current.evidence_urls.map((u, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    style={{ border: i === lightboxIdx ? '2px solid #111' : '1px solid #ddd', borderRadius: 10, width: 72, height: 72, overflow: 'hidden', background: '#fff', padding: 0, cursor: 'pointer', flex: '0 0 auto' }}
                  >
                    <img src={u} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted">Không có ảnh</div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setLightboxOpen(false)}>Đóng</CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}
