// src/views/theme/report/Alerts.jsx
import React, { useContext, useEffect, useMemo, useState, useRef } from 'react'
import {
  CAlert,
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

/** ====== API paths (gateway 8888) ====== */
const PENDING_API = apiUrl('/feedback/report/searchByStatusPending')
const UPDATE_STATUS_API = apiUrl('/feedback/report/updateStatus')

const darkCardStyle = {
  background: '#111',
  color: '#fff',
  borderRadius: 12,
  padding: 12,
}
const darkLabelStyle = { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }
const darkMetaStyle = { fontSize: 12, color: 'rgba(255,255,255,0.8)' }

// paths từ “source user” để lấy product + profile
const PRODUCT_LIST_PATH = '/product/getProducts'
const PUBLIC_PROFILE_PATH = (userId) => `/info/profiles/${encodeURIComponent(userId)}`

/** ====== Helpers ====== */
const pickImageUrl = (images = []) =>
  images?.find?.(
    (it) => typeof it?.url === 'string' && !String(it.url).toLowerCase().endsWith('.mp4'),
  )?.url || '/img/default.png'

const pickAllImageUrls = (images = []) =>
  (Array.isArray(images) ? images : [])
    .filter(
      (it) => it && typeof it.url === 'string' && !String(it.url).toLowerCase().endsWith('.mp4'),
    )
    .map((it) => it.url)

const normalizeAvatarUrl = (val) => {
  if (!val) return '/img/default-user.png'
  if (/^https?:\/\//i.test(val)) return val
  const CDN_BASE = 'https://shopping-iuh-application.s3.ap-southeast-1.amazonaws.com/'
  return CDN_BASE + String(val).replace(/^\/+/, '')
}

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

const Alerts = () => {
  const { authFetch, isAuthenticated } = useContext(AuthContext) || {}

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [productDetail, setProductDetail] = useState(null) // {id, sellerId, name, image, images[], description}
  const [userDetail, setUserDetail] = useState(null) // {id, name, avatar}
  const [updating, setUpdating] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0) // ảnh đang active trong modal
  const [actionReason, setActionReason] = useState('') // lý do xử lý/reject

  // sellerId để gọi report-violation
  const [sellerId, setSellerId] = useState(null)

  // Ảnh chứng cứ (File[]) và preview URL
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [evidencePreviews, setEvidencePreviews] = useState([])

  // ref cho input file
  const fileRef = useRef(null)

  /** Load list báo cáo ĐANG CHỜ */
  const loadPending = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(PENDING_API, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (res.status === 401)
        throw new Error('401 Không được phép: token thiếu/hết hạn/không hợp lệ.')
      if (res.status === 403) throw new Error('403 Cấm truy cập: không đủ quyền.')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.code !== 200) throw new Error(data?.message || `HTTP ${res.status}`)
      setRows(Array.isArray(data?.result) ? data.result : [])
    } catch (e) {
      setError(e.message || 'Không tải được danh sách.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authFetch])

  /** Search/filter */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.id, r.productId, r.userId, r.reason]
        .map((x) => (x || '').toString().toLowerCase())
        .some((s) => s.includes(q)),
    )
  }, [rows, search])

  /** Lấy Product theo productId (trả thêm sellerId để fallback) */
  const fetchProductFor = async (productId) => {
    try {
      const listRes = await authFetch(apiUrl(PRODUCT_LIST_PATH), {
        headers: { Accept: 'application/json' },
      })
      const listData = await listRes.json().catch(() => ({}))
      if (!listRes.ok) throw new Error(listData.message || `HTTP ${listRes.status}`)
      const found = (listData?.result || []).find((p) => p.id === productId)
      if (!found) throw new Error('Không tìm thấy sản phẩm')

      const sid = found?.sellerId || found?.seller_id || null
      setSellerId(sid) // giữ vào state

      const imgs = pickAllImageUrls(found?.images || [])
      return {
        id: found.id,
        sellerId: sid, // giữ lại trong productDetail
        name: found?.name || found?.productName || 'Sản phẩm không xác định',
        image: pickImageUrl(found?.images || []),
        images: imgs.length ? imgs : ['/img/default.png'],
        description: found?.description || '',
      }
    } catch {
      return null
    }
  }

  /** Lấy User theo userId */
  const fetchUserFor = async (userId) => {
    try {
      const res = await authFetch(apiUrl(PUBLIC_PROFILE_PATH(userId)), {
        headers: { Accept: 'application/json' },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`)
      const d = json.result ?? json

      const first = d?.first_name ?? d?.firstName ?? d?.given_name ?? d?.givenName ?? ''
      const last = d?.last_name ?? d?.lastName ?? d?.family_name ?? d?.familyName ?? ''
      let name = [first, last].filter(Boolean).join(' ').trim()
      if (!name) {
        name =
          d?.full_name ??
          d?.fullName ??
          d?.displayName ??
          d?.username ??
          d?.email ??
          d?.name ??
          'Người dùng không xác định'
      }
      const avatar = normalizeAvatarUrl(
        d?.public_id || d?.avatar_link || d?.avatarUrl || d?.avatar || d?.photoUrl,
      )
      return { id: userId, name, avatar: avatar || '/img/default-user.png' }
    } catch {
      return { id: userId, name: 'Người dùng không xác định', avatar: '/img/default-user.png' }
    }
  }

  /** Bấm Xem */
  const onView = async (report) => {
    setViewing(report)

    // Fallback 0: nếu bản ghi pending có sellerId thì set luôn
    if (report?.sellerId || report?.seller_id) {
      setSellerId(report.sellerId || report.seller_id)
    }

    setModalOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setProductDetail(null)
    setUserDetail(null)
    setActiveIdx(0)
    setActionReason('')
    setEvidenceFiles([])
    setEvidencePreviews([])

    try {
      const [p, u] = await Promise.all([fetchProductFor(report.productId), fetchUserFor(report.userId)])
      if (!p && !u) throw new Error('Không tải được thông tin chi tiết.')
      setProductDetail(p)
      setUserDetail(u)

      // Fallback 1: nếu chưa có sellerId mà product trả về có
      if (!sellerId && p?.sellerId) setSellerId(p.sellerId)
    } catch (e) {
      setDetailError(e.message || 'Không tải được chi tiết.')
    } finally {
      setDetailLoading(false)
    }
  }

  // Upload ảnh -> trả URL
  const uploadEvidenceFiles = async (files = []) => {
    if (!files?.length) return []
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    const res = await authFetch(apiUrl('/file/s3/upload'), { method: 'POST', body: fd })
    const raw = await res.text()
    let data = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = { message: raw } }
    if (!res.ok || data?.code !== 200) throw new Error(data?.message || `HTTP ${res.status}`)
    return Array.isArray(data?.result) ? data.result : []
  }

  // Report violation (JSON) – có product_id
  const reportSellerViolation = async ({ seller_id, product_id, violation_type, description, evidence_urls }) => {
  const res = await authFetch(apiUrl('/info/sellers/report-violation'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ seller_id, product_id, violation_type, description, evidence_urls }),
  })
    const raw = await res.text()
    let data = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = { message: raw } }
    if (!res.ok || (data?.code && data.code !== 200)) throw new Error(data?.message || `HTTP ${res.status}`)
    return data?.result ?? true
  }

  /** Xử lý trạng thái */
  const updateStatus = async (newStatus) => {
    if (!viewing) return
    setUpdating(true)
    setDetailError('')
    try {
      // 1) Update status trước
      const payload = {
        reportId: viewing.id,
        productId: viewing.productId,
        status: newStatus,
        reason:
          (actionReason && actionReason.trim()) ||
          (newStatus === 'RESOLVED' ? 'Đã xử lý báo cáo' : 'Từ chối báo cáo'),
      }

      const res = await authFetch(UPDATE_STATUS_API, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) throw new Error('401 Không được phép')
      if (res.status === 403) throw new Error('403 Cấm truy cập')

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.code !== 200) throw new Error(data?.message || `HTTP ${res.status}`)

      // Cập nhật UI ngay
      setRows((prev) => prev.filter((r) => r.id !== viewing.id))
      setModalOpen(false)

      // 2) Nếu RESOLVED → upload ảnh + report-violation (học theo ProductList)
      if (newStatus === 'RESOLVED') {
        try {
          const resolvedSellerId =
            sellerId ||
            productDetail?.sellerId ||
            viewing?.sellerId ||
            viewing?.seller_id ||
            null
          const resolvedProductId = viewing?.productId || productDetail?.id || null

          if (!resolvedSellerId || !resolvedProductId) {
            console.warn('[report-violation] Thiếu sellerId/productId', {
              resolvedSellerId, resolvedProductId, viewing,
            })
          } else {
            const evidence_urls = await uploadEvidenceFiles(evidenceFiles)
            await reportSellerViolation({
              seller_id: resolvedSellerId,
              product_id: resolvedProductId, // gửi product_id
              violation_type: 'FAKE_PRODUCT', // hoặc 'POLICY_VIOLATION' theo nghiệp vụ
              description:
                (actionReason && actionReason.trim()) ||
                viewing?.reason ||
                'Vi phạm chính sách',
              evidence_urls,
            })
          }
        } catch (e) {
          console.warn('Report violation thất bại:', e?.message)
        }
      }
    } catch (err) {
      setDetailError(err.message || 'Cập nhật trạng thái thất bại.')
    } finally {
      setUpdating(false)
    }
  }

  // ===== Handlers UI cho chọn ảnh =====
  const openFileDialog = () => fileRef.current?.click()

  const handleFiles = (files) => {
    const list = Array.from(files || []).filter((f) => f.type?.startsWith('image/'))
    if (!list.length) return
    // gộp với ảnh cũ (tránh trùng theo name+size)
    const existingKey = new Set(evidenceFiles.map((f) => `${f.name}-${f.size}`))
    const merged = [
      ...evidenceFiles,
      ...list.filter((f) => !existingKey.has(`${f.name}-${f.size}`)),
    ]
    setEvidenceFiles(merged)
    setEvidencePreviews((prev) => [...prev, ...list.map((f) => URL.createObjectURL(f))])
  }

  const onEvidenceChange = (e) => handleFiles(e.target.files)

  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const removeEvidence = (idx) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx))
    setEvidencePreviews((prev) => {
      const copy = [...prev]
      const [url] = copy.splice(idx, 1)
      if (url) URL.revokeObjectURL(url)
      return copy
    })
  }

  return (
    <CRow>
      {/* CSS nhỏ cho nút Xem + khu vực chọn ảnh */}
      <style>{`
        .view-icon-btn{
          width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center;
          border:1px solid #d1d5db; border-radius:10px; background:#fff; cursor:pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
        }
        .view-icon-btn:hover { background:#f8fafc; border-color:#bfc6d1; box-shadow:0 6px 16px rgba(42,108,234,.15); transform: translateY(-1px); }
        .view-icon-btn:active { transform: translateY(0); }
        .view-ic-eye { width:20px; height:20px; display:inline-block; }

        /* Nút chọn ảnh đẹp */
        .btn-evi {
          display:inline-flex; align-items:center; gap:8px;
          padding:10px 14px; border-radius:10px; border:1px solid #222;
          background:#111; color:#fff; font-weight:600; cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
        }
        .btn-evi:hover { background:#0d0d0d; transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,.15); }
        .btn-evi:active { transform: translateY(0); box-shadow:none; }
        .btn-evi svg { width:18px; height:18px; }

        /* Khu vực kéo-thả */
        .evi-drop {
          margin-top:10px;
          border:1px dashed #c9ced6; border-radius:12px; background:#fafbfc;
          padding:16px; text-align:center; color:#556070;
          transition: border-color .15s ease, background .15s ease;
        }
        .evi-drop.dragover { border-color:#111; background:#f3f4f6; }
        .evi-drop .hint { font-size:12px; color:#77808b; margin-top:6px; }

        /* Grid preview */
        .evi-grid { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
        .evi-item {
          width:90px; height:90px; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; position:relative; background:#fff;
        }
        .evi-item img { width:100%; height:100%; object-fit:cover; }
        .evi-remove {
          position:absolute; top:4px; right:4px;
          width:22px; height:22px; line-height:22px; border:none; border-radius:6px;
          background:rgba(0,0,0,.6); color:#fff; cursor:pointer;
        }
        .evi-meta { font-size:12px; color:#6b7280; margin-top:6px; }
      `}</style>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex align-items-center justify-content-between">
            <div>
              <strong>Báo cáo đang chờ duyệt</strong>{' '}
              <small className="text-body-secondary">(trạng thái: Đang chờ)</small>
            </div>
            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <input
                type="text"
                placeholder="Tìm theo mã báo cáo / mã sản phẩm / mã người dùng / lý do..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: 34, borderRadius: 8, border: '1px solid #ddd', padding: '0 10px' }}
              />
              <CBadge color="warning" shape="rounded-pill">
                {filtered.length}
              </CBadge>
              <CButton
                color="dark"
                size="sm"
                disabled={loading}
                onClick={loadPending}
                title="Tải lại"
                aria-label="Tải lại"
              >
                {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="lg" />}
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
            {error && (
              <CAlert color="danger" className="mb-3">
                {error}
              </CAlert>
            )}

            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" /> Đang tải dữ liệu…
              </div>
            ) : filtered.length === 0 ? (
              <CAlert color="info" className="mb-0">
                Không có báo cáo đang chờ.
              </CAlert>
            ) : (
              <CTable align="middle" hover responsive>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell scope="col" style={{ width: 40 }}>
                      #
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col">Mã báo cáo</CTableHeaderCell>
                    <CTableHeaderCell scope="col">Lý do</CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 120 }}>
                      Trạng thái
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 170 }}>
                      Thời gian tạo
                    </CTableHeaderCell>
                    <CTableHeaderCell scope="col" style={{ width: 120 }}>
                      Thao tác
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {filtered.map((r, idx) => (
                    <CTableRow key={r.id}>
                      <CTableHeaderCell scope="row">{idx + 1}</CTableHeaderCell>
                      <CTableDataCell className="text-break">{r.id}</CTableDataCell>
                      <CTableDataCell className="text-break">{r.reason || '—'}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="warning">ĐANG CHỜ</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{fmtDate(r.createdAt)}</CTableDataCell>
                      <CTableDataCell>
                        <button
                          className="view-icon-btn"
                          onClick={() => onView(r)}
                          title="Xem chi tiết"
                          aria-label="Xem chi tiết"
                        >
                          <svg className="view-ic-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* Modal chi tiết */}
      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} alignment="center" size="lg">
        <CModalHeader>
          <CModalTitle>Chi tiết báo cáo</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detailLoading ? (
            <div className="d-flex align-items-center gap-2">
              <CSpinner size="sm" /> Đang tải chi tiết…
            </div>
          ) : detailError ? (
            <CAlert color="danger">{detailError}</CAlert>
          ) : (
            <>
              {/* ====== KHỐI SẢN PHẨM + NGƯỜI BÁO CÁO ====== */}
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
                {/* Header: Sản phẩm + Người báo cáo */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 12,
                  }}
                >
                  {/* Sản phẩm */}
                  <div style={darkCardStyle}>
                    <div style={darkLabelStyle}>Sản phẩm</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: '#000',
                          border: '1px solid rgba(255,255,255,0.2)',
                          flex: '0 0 auto',
                        }}
                      >
                        <img
                          src={productDetail?.image || '/img/default.png'}
                          alt={productDetail?.name || 'Sản phẩm'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            lineHeight: 1.25,
                            wordBreak: 'break-word',
                          }}
                        >
                          {productDetail?.name || 'Sản phẩm không xác định'}
                        </div>
                        {viewing?.productId ? (
                          <div style={darkMetaStyle}>Mã SP: {viewing.productId}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Người báo cáo */}
                  <div style={darkCardStyle}>
                    <div style={darkLabelStyle}>Người báo cáo</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: '#000',
                          border: '1px solid rgba(255,255,255,0.2)',
                          flex: '0 0 auto',
                        }}
                      >
                        <img
                          src={userDetail?.avatar || '/img/default-user.png'}
                          alt={userDetail?.name || 'Người dùng'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            lineHeight: 1.25,
                            wordBreak: 'word',
                          }}
                        >
                          {userDetail?.name || 'Người dùng không xác định'}
                        </div>
                        {viewing?.userId ? (
                          <div style={darkMetaStyle}>Mã người dùng: {viewing.userId}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bộ sưu tập ảnh */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
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
                    }}
                  >
                    <img
                      src={
                        (productDetail?.images && productDetail.images[activeIdx]) ||
                        productDetail?.image ||
                        '/img/default.png'
                      }
                      alt="Xem trước"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  {/* Thumbnails cuộn ngang */}
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {(productDetail?.images || [productDetail?.image || '/img/default.png']).map(
                      (u, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveIdx(i)}
                          style={{
                            border: i === activeIdx ? '2px solid #111' : '1px solid #ddd',
                            borderRadius: 10,
                            padding: 0,
                            width: 72,
                            height: 72,
                            overflow: 'hidden',
                            background: '#fff',
                            cursor: 'pointer',
                            flex: '0 0 auto',
                          }}
                          title={`Ảnh ${i + 1}`}
                        >
                          <img src={u} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Mô tả + lý do + meta + Ảnh chứng cứ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
                  {/* Mô tả */}
                  <div
                    style={{
                      border: '1px solid #eee',
                      borderRadius: 12,
                      padding: 12,
                      maxHeight: 180,
                      overflow: 'auto',
                      background: '#fcfcfc',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Mô tả sản phẩm</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                      {productDetail?.description || '—'}
                    </div>
                  </div>

                  {/* Lý do + thông tin báo cáo */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Lý do (người báo cáo)</div>
                      <div style={{ fontWeight: 600 }}>{viewing?.reason || '—'}</div>
                    </div>

                    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Thông tin báo cáo</div>
                      <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                        <div>Mã báo cáo: {viewing?.id}</div>
                        <div>Thời gian tạo: {fmtDate(viewing?.createdAt)}</div>
                        <div className="mt-1">
                          Trạng thái{' '}
                          <span className="badge text-bg-warning" style={{ marginLeft: 6 }}>
                            ĐANG CHỜ
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lý do xử lý (admin nhập) */}
                  <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                      Lý do xử lý (hiển thị trong lịch sử xử lý báo cáo)
                    </div>
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Nhập ghi chú/lý do xử lý…"
                      rows={3}
                      style={{
                        width: '100%',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        padding: 10,
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                      * Nếu để trống: sẽ dùng mặc định theo hành động (đã xử lý / từ chối).
                    </div>
                  </div>

                  {/* Ảnh chứng cứ – NÚT ĐẸP + KÉO-THẢ */}
                  <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Ảnh chứng cứ (tuỳ chọn)</div>

                    {/* Hidden input */}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={onEvidenceChange}
                    />

                    {/* Pretty Button */}
                    <button type="button" className="btn-evi" onClick={openFileDialog}>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Chọn ảnh chứng cứ
                    </button>

                    {/* Dropzone */}
                    <div
                      className="evi-drop"
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                    >
                      Kéo & thả ảnh vào đây
                      <div className="hint">Hỗ trợ đa ảnh • PNG/JPG/WebP</div>
                    </div>

                    {/* Previews */}
                    {evidencePreviews.length > 0 && (
                      <>
                        <div className="evi-grid">
                          {evidencePreviews.map((u, i) => (
                            <div className="evi-item" key={i}>
                              <img src={u} alt={`evi-${i}`} />
                              <button className="evi-remove" type="button" title="Xoá ảnh" onClick={() => removeEvidence(i)}>×</button>
                            </div>
                          ))}
                        </div>
                        <div className="evi-meta">
                          Đã chọn <b>{evidencePreviews.length}</b> ảnh
                        </div>
                      </>
                    )}

                    <div className="evi-meta">
                      Gợi ý: Sau khi xử lý, hệ thống sẽ tự động tải ảnh (nếu có) và gửi báo cáo vi phạm tới Seller.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="danger"
            className="btn-action-danger"
            disabled={updating || detailLoading || !viewing?.productId}
            onClick={() => updateStatus('REJECTED')}
            title="Từ chối báo cáo"
          >
            {updating ? <CSpinner size="sm" className="me-2" /> : null}
            Từ chối
          </CButton>

          <CButton
            color="dark"
            className="btn-action-dark"
            disabled={updating || detailLoading || !viewing?.productId}
            onClick={() => updateStatus('RESOLVED')}
            title="Xử lý báo cáo"
          >
            {updating ? <CSpinner size="sm" className="me-2" /> : null}
            Xử lý
          </CButton>

          <CButton color="secondary" variant="outline" onClick={() => setModalOpen(false)}>
            Đóng
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}

export default Alerts
