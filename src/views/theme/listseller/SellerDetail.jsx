// src/views/theme/seller/SellerDetail.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from 'src/contexts/AuthContext'
import { apiUrl } from 'src/config/api'
import { getSellerPolicyStatus } from 'src/services/policy'
import '../../theme/listseller/sellers-bw.css'

import { CCard, CCardBody, CCardHeader, CRow, CCol, CSpinner } from '@coreui/react'

const normalizeSeller = (r) => ({
  id: r.id,
  userId: r.user_id || r.userId,
  shopName: r.shop_name || r.shopName || '—',
  email: r.email || '—',
  avatar: r.avatar_link || r.avatarLink || null,
  address: r.address || '—',
  createdAt: r.registration_date || r.created_time || null,
  status: (r.status || 'UNKNOWN').toUpperCase(),
  wallet: r.wallet ?? null,
  docs: r.identification_link || r.identificationLinks || [],
})

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

const viStatusText = (st) => {
  switch ((st || '').toUpperCase()) {
    case 'APPROVED':
      return 'ĐÃ DUYỆT'
    case 'REJECTED':
      return 'BỊ TỪ CHỐI'
    case 'PENDING':
      return 'CHỜ DUYỆT'
    case 'AVAILABLE':
      return 'ĐANG BÁN'
    case 'UNAVAILABLE':
      return 'NGỪNG BÁN'
    default:
      return String(st || 'KHÔNG RÕ')
  }
}

const fmtVnd = (n) => {
  if (n == null || Number.isNaN(n)) return '—'
  try {
    return n.toLocaleString('vi-VN') + '₫'
  } catch {
    return `${n}₫`
  }
}

/* ================== Helpers chuẩn hoá cho modal chi tiết ================== */
const toNum = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

// Chuẩn hoá ảnh về [{url, position}]
const normImages = (imgRaw) => {
  if (!imgRaw) return []
  if (Array.isArray(imgRaw)) {
    if (
      imgRaw.length &&
      typeof imgRaw[0] === 'object' &&
      ('url' in imgRaw[0] || 'imageUrl' in imgRaw[0] || 'src' in imgRaw[0] || 'path' in imgRaw[0])
    ) {
      return imgRaw
        .map((i, idx) => ({
          url: i.url || i.imageUrl || i.src || i.path || '',
          position: i.position ?? i.order ?? idx,
        }))
        .filter((x) => x.url)
    }
    // dạng ['url1','url2']
    return imgRaw.map((u, idx) => ({ url: String(u), position: idx }))
  }
  // dạng 1 string
  if (typeof imgRaw === 'string') return [{ url: imgRaw, position: 0 }]
  return []
}

// Chuẩn hoá biến thể về {size, price, compareAtPrice, quantity, available}
const normSizes = (raw) => {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.sizes)
      ? raw.sizes
      : Array.isArray(raw?.variants)
        ? raw.variants
        : Array.isArray(raw?.productItems)
          ? raw.productItems
          : Array.isArray(raw?.productSizes)
            ? raw.productSizes
            : []

  return arr.map((s) => ({
    size: s.size ?? s.sizeName ?? s.optionValue ?? s.variantName ?? s.sku ?? '—',
    price: toNum(s.price ?? s.unitPrice ?? s.sellingPrice ?? s.retailPrice),
    compareAtPrice: toNum(s.compareAtPrice ?? s.listPrice ?? s.originalPrice),
    quantity: toNum(s.quantity ?? s.stock ?? s.stockQuantity) ?? 0,
    available: Boolean(s.available ?? (toNum(s.quantity ?? s.stock ?? s.stockQuantity) ?? 0) > 0),
  }))
}

/* ============== Chuẩn hoá cho lưới danh sách sản phẩm (brief) ============== */
const normalizeProduct = (p) => {
  const imgs = Array.isArray(p.images) ? p.images : []
  const imNormalized = normImages(imgs)
  const mainImg = imNormalized.length
    ? imNormalized.slice().sort((a, b) => (a?.position ?? 999) - (b?.position ?? 999))[0]?.url
    : null

  const sizes = normSizes(p) // nếu BE có sẵn thì lấy, không thì array rỗng
  const prices = sizes.map((s) => s.price).filter((x) => typeof x === 'number')
  const qtys = sizes.map((s) => s.quantity).filter((x) => typeof x === 'number')
  const minP = prices.length ? Math.min(...prices) : null
  const maxP = prices.length ? Math.max(...prices) : null
  const totalQty = qtys.length ? qtys.reduce((a, b) => a + b, 0) : 0

  return {
    id: p.id,
    name: p.name || '—',
    status: (p.status || 'UNKNOWN').toUpperCase(),
    image: mainImg,
    minPrice: minP,
    maxPrice: maxP,
    totalQty,
    createdAt: p.createdAt || p.created_time || null,
  }
}

export default function SellerDetail() {
  const { id } = useParams()
  const { authFetch, isAuthenticated } = useContext(AuthContext)
  const navigate = useNavigate()

  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Policy status
  const [policyStatus, setPolicyStatus] = useState(null)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policyErr, setPolicyErr] = useState('')

  // Sản phẩm của shop
  const [prodLoading, setProdLoading] = useState(true)
  const [prodErr, setProdErr] = useState('')
  const [products, setProducts] = useState([]) // list đã normalize để hiển thị
  const [rawProducts, setRawProducts] = useState([]) // dữ liệu raw để lấy id mở modal

  // Modal xem sản phẩm
  const [showProd, setShowProd] = useState(false)
  const [activeProd, setActiveProd] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Icon quay lại
  const IconBack = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 18l-6-6 6-6"
        fill="none"
        stroke="#111827"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  // === Fetch chi tiết seller ===
  useEffect(() => {
    if (!isAuthenticated) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      setErr('')
      setSeller(null)
      try {
        let detailOk = false
        try {
          const res = await authFetch(apiUrl(`/info/sellers/${id}`), { method: 'GET' })
          const raw = await res.text()
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = { message: raw }
          }

          if (res.ok && data) {
            const payload = data?.result ?? data
            if (payload && (payload.id || payload.user_id)) {
              detailOk = true
              if (mounted) setSeller(normalizeSeller(payload))
            }
          }
        } catch (_) {
          /* silent */
        }

        if (!detailOk) {
          const res = await authFetch(apiUrl('/info/sellers'), { method: 'GET' })
          const raw = await res.text()
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = { message: raw }
          }
          if (!res.ok || (data?.code && data.code !== 200)) {
            const msg = data?.message || data?.error || `HTTP ${res.status}`
            throw new Error(msg)
          }
          const list = Array.isArray(data?.result) ? data.result.map(normalizeSeller) : []
          const found = list.find((x) => x.id === id)
          if (!found) throw new Error('Không tìm thấy người bán.')
          if (mounted) setSeller(found)
        }
      } catch (e) {
        if (mounted) setErr(e.message || 'Không tải được chi tiết người bán.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [authFetch, isAuthenticated, id])

  // === Fetch trạng thái chính sách sau khi có seller.id ===
  useEffect(() => {
    if (!seller?.id) return
    let mounted = true
    ;(async () => {
      try {
        setPolicyLoading(true)
        setPolicyErr('')
        const ps = await getSellerPolicyStatus(authFetch, seller.id) // sellerId
        if (mounted) setPolicyStatus(ps || null)
      } catch (e) {
        if (mounted) {
          setPolicyErr(e.message || 'Không lấy được trạng thái chính sách')
          setPolicyStatus(null)
        }
      } finally {
        if (mounted) setPolicyLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [authFetch, seller?.id])

  // Badge trạng thái (seller)
  const badge = useMemo(() => {
    const st = (seller?.status || 'UNKNOWN').toUpperCase()
    const cls =
      st === 'APPROVED'
        ? 'badge-ok'
        : st === 'REJECTED'
          ? 'badge-bad'
          : st === 'PENDING'
            ? 'badge-warn'
            : 'badge-neutral'
    return <span className={`s-badge ${cls}`}>{viStatusText(st)}</span>
  }, [seller])

  // === Fetch danh sách sản phẩm của shop ===
  useEffect(() => {
    if (!isAuthenticated || !id) return
    let mounted = true
    ;(async () => {
      setProdLoading(true)
      setProdErr('')
      setProducts([])
      setRawProducts([])
      try {
        const res = await authFetch(apiUrl(`/product/searchBySeller/${id}`), { method: 'GET' })
        const raw = await res.text()
        let data = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = { message: raw }
        }

        if (!res.ok || (data?.code && data.code !== 200)) {
          const msg = data?.message || data?.error || `HTTP ${res.status}`
          throw new Error(msg)
        }
        const rawList = Array.isArray(data?.result) ? data.result : []
        const normList = rawList.map(normalizeProduct)
        if (mounted) {
          setRawProducts(rawList)
          setProducts(normList)
        }
      } catch (e) {
        if (mounted) setProdErr(e.message || 'Không tải được sản phẩm của shop.')
      } finally {
        if (mounted) setProdLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [authFetch, isAuthenticated, id])

  /* ================== MỞ MODAL: gọi chi tiết sản phẩm ================== */
  const openProductModal = async (pid) => {
    const brief = rawProducts.find((p) => p.id === pid)
    if (!brief) return

    setShowProd(true)
    setModalLoading(true)
    setActiveProd(null)
    setSelectedImage(null)

    try {
      // TODO: ĐỔI endpoint này cho đúng BE thực tế (ví dụ: /product/getById/:id)
      const res = await authFetch(apiUrl(`/product/${pid}`), {
        headers: { Accept: 'application/json' },
      })
      const raw = await res.text()
      const j = raw ? JSON.parse(raw) : {}
      if (!res.ok || (j?.code && j.code !== 200)) {
        throw new Error(j?.message || `HTTP ${res.status}`)
      }
      const detail = j?.result ?? j

      const merged = {
        ...brief,
        ...detail,
        images: normImages(detail?.images ?? brief?.images),
        sizes: normSizes(
          detail?.sizes ??
            detail?.variants ??
            detail?.productItems ??
            detail?.productSizes ??
            brief,
        ),
      }
      const sorted = [...(merged.images || [])].sort(
        (a, b) => (a.position ?? 999) - (b.position ?? 999),
      )
      setSelectedImage(sorted[0]?.url || null)
      setActiveProd(merged)
    } catch (e) {
      // fallback: dùng brief nhưng vẫn normalize
      const merged = {
        ...brief,
        images: normImages(brief?.images),
        sizes: normSizes(brief),
      }
      const sorted = [...(merged.images || [])].sort(
        (a, b) => (a.position ?? 999) - (b.position ?? 999),
      )
      setSelectedImage(sorted[0]?.url || null)
      setActiveProd(merged)
    } finally {
      setModalLoading(false)
    }
  }

  const closeProductModal = () => {
    setShowProd(false)
    setActiveProd(null)
    setSelectedImage(null)
    setModalLoading(false)
  }

  return (
    <CCard className="bw-card fade-in">
      <CCardHeader className="bw-header">
        <div className="bw-header-inner">
          <div className="left">
            <button
              className="icon-btn ghost"
              onClick={() => navigate(-1)}
              title="Quay lại"
              aria-label="Quay lại"
            >
              <IconBack />
            </button>
            <strong className="bw-title">Chi tiết Người bán</strong>
          </div>
          <div className="right" />
        </div>
      </CCardHeader>

      <CCardBody>
        {err && <div className="text-danger mb-2">{err}</div>}
        {loading ? (
          <div className="py-5 text-center">
            <CSpinner />
          </div>
        ) : seller ? (
          <div className="sd-wrap">
            <CRow className="sd-grid">
              <CCol md={4}>
                <div className="sd-card">
                  <div className="sd-avatar-wrap">
                    {seller.avatar ? (
                      <img
                        src={seller.avatar}
                        alt=""
                        className="bw-avatar"
                        onError={(e) => {
                          e.currentTarget.replaceWith(
                            Object.assign(document.createElement('div'), {
                              className: 'bw-avatar placeholder',
                              innerText: '🏪',
                            }),
                          )
                        }}
                      />
                    ) : (
                      <div className="bw-avatar placeholder">🏪</div>
                    )}
                  </div>
                  <div className="sd-name">{seller.shopName}</div>
                  <div className="sd-status">{badge}</div>
                </div>
              </CCol>

              <CCol md={8}>
                <div className="sd-card">
                  <div className="sd-row">
                    <div className="sd-label">Email</div>
                    <div className="sd-value">
                      {seller.email ? <a href={`mailto:${seller.email}`}>{seller.email}</a> : '—'}
                    </div>
                  </div>
                  <div className="sd-row">
                    <div className="sd-label">Địa chỉ</div>
                    <div className="sd-value">{seller.address || '—'}</div>
                  </div>
                  <div className="sd-row">
                    <div className="sd-label">Ngày đăng ký</div>
                    <div className="sd-value">{fmtDate(seller.createdAt)}</div>
                  </div>
                  <div className="sd-row">
                    <div className="sd-label">Số dư ví</div>
                    <div className="sd-value">{seller.wallet ?? '—'}</div>
                  </div>
                  <div className="sd-row">
                    <div className="sd-label">Mã người dùng</div>
                    <div className="sd-value monospace">{seller.userId || '—'}</div>
                  </div>
                </div>
              </CCol>
            </CRow>

            {/* ====== Trạng thái Chính sách Seller TOS ====== */}
            <div className="sd-card mt-3">
              <div className="sd-section-title">Chính sách Seller TOS</div>

              {policyLoading ? (
                <div className="py-2">Đang tải trạng thái chính sách…</div>
              ) : policyErr ? (
                <div className="wk-note warn">{policyErr}</div>
              ) : policyStatus ? (
                <div className="policy-grid">
                  <div className="sd-row">
                    <div className="sd-label">Phiên bản hiện tại</div>
                    <div className="sd-value">{policyStatus.currentVersion || '—'}</div>
                  </div>

                  <div className="sd-row">
                    <div className="sd-label">Đã chấp thuận</div>
                    <div className="sd-value">
                      {policyStatus.needReconsent === false ? (
                        <span className="badge success" style={{ color: '#111' }}>
                          ĐÃ CHẤP THUẬN
                        </span>
                      ) : (
                        <span className="badge warn">CHƯA</span>
                      )}
                    </div>
                  </div>

                  <div className="sd-row">
                    <div className="sd-label">Thời điểm chấp thuận gần nhất</div>
                    <div className="sd-value">
                      {policyStatus.lastConsentedAt ? fmtDate(policyStatus.lastConsentedAt) : '—'}
                    </div>
                  </div>

                  <div className="sd-row">
                    <div className="sd-label">Yêu cầu đồng ý lại</div>
                    <div className="sd-value">{policyStatus.needReconsent ? 'Có' : 'Không'}</div>
                  </div>

                  <div className="sd-row">
                    <div className="sd-label">PDF hiện hành</div>
                    <div className="sd-value">
                      {policyStatus.currentPdfUrl ? (
                        <a href={policyStatus.currentPdfUrl} target="_blank" rel="noreferrer">
                          Mở PDF
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="wk-note">Không có dữ liệu chính sách.</div>
              )}
            </div>

            {/* Giấy tờ */}
            <div className="sd-card mt-3">
              <div className="sd-section-title">Giấy tờ / Ảnh xác minh</div>
              <div className="doc-grid">
                {(seller.docs || []).length === 0 && (
                  <div className="text-muted">Không có tài liệu.</div>
                )}
                {(seller.docs || []).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="doc-item"
                    title={url}
                  >
                    <img
                      src={url}
                      alt=""
                      className="doc-thumb"
                      onError={(e) => {
                        e.currentTarget.replaceWith(
                          Object.assign(document.createElement('div'), {
                            className: 'doc-thumb placeholder',
                            innerText: '🗂️',
                            title: url,
                          }),
                        )
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>

            {/* ====================== Sản phẩm của shop ====================== */}
            <div className="sd-card mt-3">
              <div className="sd-section-title">Sản phẩm của shop</div>

              {prodErr && <div className="text-danger mb-2">{prodErr}</div>}
              {prodLoading ? (
                <div className="py-4 text-center">
                  <CSpinner />
                </div>
              ) : (
                <div className="prod-grid">
                  {(!products || products.length === 0) && (
                    <div className="text-muted">Chưa có sản phẩm.</div>
                  )}

                  {(products || []).map((p) => (
                    <div key={p.id} className="prod-item fade-in" title={p.name}>
                      <div className="prod-thumb-wrap">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            className="prod-thumb"
                            onError={(e) => {
                              e.currentTarget.replaceWith(
                                Object.assign(document.createElement('div'), {
                                  className: 'prod-thumb placeholder',
                                  innerText: '🛍️',
                                }),
                              )
                            }}
                          />
                        ) : (
                          <div className="prod-thumb placeholder">🛍️</div>
                        )}
                      </div>

                      <div className="prod-name">{p.name}</div>

                      <div className="prod-meta">
                        <span className="price">
                          {p.minPrice == null
                            ? '—'
                            : p.maxPrice && p.maxPrice !== p.minPrice
                              ? `${fmtVnd(p.minPrice)} – ${fmtVnd(p.maxPrice)}`
                              : fmtVnd(p.minPrice)}
                        </span>
                        <span className="sep">•</span>
                        <span className="qty">Tồn: {p.totalQty}</span>
                      </div>

                      <div className="prod-bottom">
                        <span
                          className={`p-badge ${
                            p.status === 'AVAILABLE'
                              ? 'badge-ok'
                              : p.status === 'UNAVAILABLE'
                                ? 'badge-bad'
                                : 'badge-neutral'
                          }`}
                        >
                          {viStatusText(p.status)}
                        </span>
                        <span className="created">{fmtDate(p.createdAt)}</span>
                      </div>

                      {/* Nút xem modal chi tiết sản phẩm */}
                      <div className="prod-actions">
                        <button className="bw-btn-solid sm" onClick={() => openProductModal(p.id)}>
                          Xem
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* =============================================================== */}
          </div>
        ) : (
          <div className="text-muted">Không có dữ liệu.</div>
        )}
      </CCardBody>

      {/* ============== Modal xem chi tiết sản phẩm ============== */}
      {showProd && (
        <div className="wk-modal-backdrop" role="dialog" aria-modal="true">
          <div className="wk-modal prod-modal modal-zoom" style={{ width: 650 }}>
            {/* Header thanh mảnh + nút đóng */}
            <div className="wk-modal-head">
              <h3 className="wk-modal-title">{activeProd?.name || 'Chi tiết sản phẩm'}</h3>
              <button className="wk-modal-close" onClick={closeProductModal} aria-label="Đóng">
                ×
              </button>
            </div>

            {modalLoading ? (
              <div className="prod-modal-body">
                <div className="pm-left">
                  <div className="pm-mainimg skeleton" style={{ height: 280, borderRadius: 12 }} />
                  <div className="pm-thumbs" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8 }} />
                    <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8 }} />
                    <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8 }} />
                  </div>
                </div>
                <div className="pm-right">
                  <div className="skeleton" style={{ height: 16, marginBottom: 8, width: '50%' }} />
                  <div className="skeleton" style={{ height: 16, marginBottom: 8, width: '60%' }} />
                  <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
                </div>
              </div>
            ) : (
              activeProd && (
                <div className="prod-modal-body">
                  {/* Ảnh: ảnh chính + strip thumbnails */}
                  <div className="pm-left">
                    <div className="pm-mainimg">
                      {selectedImage ? (
                        <img
                          src={selectedImage}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.replaceWith(
                              Object.assign(document.createElement('div'), {
                                className: 'pm-mainimg placeholder',
                                innerText: '🖼️',
                              }),
                            )
                          }}
                        />
                      ) : (
                        <div className="placeholder">🖼️</div>
                      )}
                    </div>
                    {Array.isArray(activeProd.images) && activeProd.images.length > 1 && (
                      <div className="pm-thumbs">
                        {[...activeProd.images]
                          .sort((a, b) => (a?.position ?? 999) - (b?.position ?? 999))
                          .map((im, i) => (
                            <button
                              key={i}
                              className={`pm-thumb ${selectedImage === im.url ? 'active' : ''}`}
                              onClick={() => setSelectedImage(im.url)}
                              title="Click để xem ảnh lớn"
                            >
                              <img
                                src={im.url}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.replaceWith(
                                    Object.assign(document.createElement('div'), {
                                      className: 'pm-thumb-placeholder',
                                      innerText: '🖼️',
                                    }),
                                  )
                                }}
                              />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="pm-right">
                    <div className="pm-row">
                      <div className="pm-label">Trạng thái</div>
                      <div className="pm-value">
                        <span
                          className={`p-badge ${
                            (activeProd.status || '').toUpperCase() === 'AVAILABLE'
                              ? 'badge-ok'
                              : (activeProd.status || '').toUpperCase() === 'UNAVAILABLE'
                                ? 'badge-bad'
                                : 'badge-neutral'
                          }`}
                        >
                          {viStatusText(activeProd.status)}
                        </span>
                      </div>
                    </div>

                    <div className="pm-row">
                      <div className="pm-label">Ngày tạo</div>
                      <div className="pm-value">{fmtDate(activeProd.createdAt)}</div>
                    </div>

                    <div className="pm-row">
                      <div className="pm-label">Mô tả</div>
                      <div className="pm-value prod-desc">{activeProd.description || '—'}</div>
                    </div>

                    <div className="pm-row pm-row-full">
                      <div className="pm-label">Phiên bản / Size</div>
                      <div className="pm-value">
                        <div className="pm-sizes">
                          <div className="pm-size-header">
                            <div>Size</div>
                            <div>Giá</div>
                            <div>Giá so sánh</div>
                            <div>Tồn</div>
                            <div>Khả dụng</div>
                          </div>
                          {Array.isArray(activeProd.sizes) && activeProd.sizes.length ? (
                            activeProd.sizes.map((s, i) => (
                              <div key={i} className="pm-size-row">
                                <div>{s?.size ?? '—'}</div>
                                <div>{fmtVnd(s?.price)}</div>
                                <div
                                  className={
                                    s?.compareAtPrice && s.compareAtPrice > (s?.price || 0)
                                      ? 'strike'
                                      : ''
                                  }
                                >
                                  {s?.compareAtPrice ? fmtVnd(s.compareAtPrice) : '—'}
                                </div>
                                <div>{s?.quantity ?? 0}</div>
                                <div>{s?.available ? 'Còn' : 'Hết'}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted">Không có dữ liệu size.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="wk-modal-actions">
              <button className="btn ghost" onClick={closeProductModal}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
    </CCard>
  )
}
