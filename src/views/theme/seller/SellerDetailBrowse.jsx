// src/pages/seller/admin/SellerDetail.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../../contexts/AuthContext'
import { listPendingSellers, verifySeller } from 'src/services/adminSellers'
import { getSellerPolicyStatus } from 'src/services/policy'
import { showToast } from 'src/lib/toast-bus'
import '../../../styles/SellerDetail.css'

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

export default function SellerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authFetch } = useContext(AuthContext)

  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // trạng thái cho duyệt / từ chối
  const [submitting, setSubmitting] = useState(false)

  // modal từ chối
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // trạng thái Policy
  const [policyStatus, setPolicyStatus] = useState(null)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policyErr, setPolicyErr] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const items = await listPendingSellers(authFetch)
        const found =
          items.find((s) => String(s.id) === String(id)) ||
          items.find((s) => String(s.userId) === String(id))
        if (!found) throw new Error('Không tìm thấy seller')
        setSeller(found)
      } catch (e) {
        const msg = e.message || 'Lỗi tải dữ liệu'
        setErr(msg)
        getToastAPI().show?.({ title: 'Lỗi', text: msg, type: 'error', duration: 3500 })
      } finally {
        setLoading(false)
      }
    })()
  }, [id, authFetch])

  // Sau khi đã có seller.id thì gọi trạng thái policy
  useEffect(() => {
    ;(async () => {
      if (!seller?.id) return
      try {
        setPolicyLoading(true)
        setPolicyErr('')
        const ps = await getSellerPolicyStatus(authFetch, seller.id) // dùng sellerId
        setPolicyStatus(ps || null)
      } catch (e) {
        const msg = e.message || 'Không lấy được trạng thái chính sách'
        setPolicyErr(msg)
        setPolicyStatus(null)
        getToastAPI().show?.({ title: 'Lỗi', text: msg, type: 'error', duration: 3500 })
      } finally {
        setPolicyLoading(false)
      }
    })()
  }, [authFetch, seller?.id])

  const approveSeller = async () => {
    if (!seller) return

    const ok = await getToastAPI().confirm({
      title: 'Duyệt hồ sơ',
      text: 'Xác nhận duyệt seller này?',
      confirmText: 'Duyệt',
      cancelText: 'Huỷ',
      type: 'info',
    })
    if (!ok) return

    try {
      setSubmitting(true)
      await verifySeller(authFetch, { sellerId: seller.id, status: 'APPROVED' })
      getToastAPI().show?.({ title: 'Đã duyệt', type: 'success', duration: 2200 })
      navigate(-1)
    } catch (e) {
      getToastAPI().show?.({
        title: 'Lỗi duyệt',
        text: e?.message || 'Không thể duyệt',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openReject = () => {
    setRejectReason('')
    setShowRejectModal(true)
  }

  const sendReject = async () => {
    if (!seller) return

    const ok = await getToastAPI().confirm({
      title: 'Từ chối hồ sơ',
      text: 'Xác nhận từ chối seller này?',
      confirmText: 'Từ chối',
      cancelText: 'Huỷ',
      type: 'warning',
    })
    if (!ok) return

    try {
      setSubmitting(true)
      const payload = {
        sellerId: seller.id,
        status: 'REJECTED',
      }
      if (rejectReason?.trim()) payload.reason = rejectReason.trim()

      await verifySeller(authFetch, payload)
      getToastAPI().show?.({ title: 'Đã từ chối', type: 'success', duration: 2200 })
      setShowRejectModal(false)
      navigate(-1)
    } catch (e) {
      getToastAPI().show?.({
        title: 'Lỗi từ chối',
        text: e?.message || 'Không thể từ chối',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="wk-container">
        <p>Đang tải...</p>
      </div>
    )
  if (err)
    return (
      <div className="wk-container error">
        <p>{err}</p>
      </div>
    )

  // Đồng nhất field để render (đề phòng BE trả snake_case)
  const avatar = seller.avatar || seller.avatar_link
  const shopName = seller.shopName || seller.shop_name || '—'
  const email = seller.email || '—'
  const address = seller.address || '—'
  const createdAt = seller.createdAt || seller.registration_date || '—'
  const docs = seller.identificationLinks || seller.identification_link || seller.documents || []

  return (
    <div className="wk-container">
      <div className="wk-content">
        {/* Hero header */}
        <header className="wk-hero">
          <h1 className="wk-hero-title">
            Chi tiết <span>Nhà Bán</span>
          </h1>
          <p className="wk-hero-subtitle">Thông tin đăng ký & xác thực của người bán</p>
        </header>

        {/* Seller info card */}
        <section className="sp-section card">
          <div className="legal-grid">
            {/* Left: avatar + info */}
            <div className="legal-left">
              <div className="wk-logo-upload-section">
                <div className="wk-logo-upload-area">
                  <label className="wk-form-label">Ảnh Shop</label>
                  {avatar ? (
                    <img src={avatar} alt="Logo gian hàng" className="wk-logo-preview" />
                  ) : (
                    <div className="wk-logo-placeholder">🏪</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <label>Tên cửa hàng</label>
                <div className="control readonly">{shopName}</div>
              </div>

              <div className="form-row">
                <label>Email liên hệ</label>
                <div className="control readonly">{email}</div>
              </div>

              <div className="form-row">
                <label>Địa chỉ</label>
                <div className="control readonly">{address}</div>
              </div>

              <div className="form-row">
                <label>Ngày đăng ký</label>
                <div className="control readonly">{createdAt}</div>
              </div>
            </div>

            {/* Right: giấy tờ */}
            <div className="legal-right">
              <div className="sp-section-head">
                <h2>Giấy tờ pháp lý</h2>
                <p className="sub">Ảnh xác thực danh tính & địa chỉ kinh doanh</p>
              </div>

              <div className="upload-grid horizontal">
                {Array.isArray(docs) && docs.length > 0 ? (
                  docs.map((link, idx) => (
                    <a
                      href={link}
                      key={idx}
                      target="_blank"
                      rel="noreferrer"
                      className="upload-card has-image"
                    >
                      <img src={link} alt={`Giấy tờ ${idx + 1}`} className="preview" />
                    </a>
                  ))
                ) : (
                  <div style={{ color: '#64748b' }}>Chưa có giấy tờ</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Policy status card */}
        <section className="sp-section card" style={{ marginTop: 16 }}>
          <div className="sp-section-head">
            <h2>Chính sách Seller TOS</h2>
            <p className="sub">Trạng thái chấp thuận hiện tại của người bán</p>
          </div>

          {policyLoading ? (
            <div className="wk-note">Đang tải trạng thái chính sách…</div>
          ) : policyErr ? (
            <div className="wk-note warn">{policyErr}</div>
          ) : policyStatus ? (
            <div className="policy-grid">
              <div className="form-row">
                <label>Phiên bản hiện tại</label>
                <div className="control readonly">{policyStatus.currentVersion || '—'}</div>
              </div>

              <div className="form-row">
                <label>Đã chấp thuận</label>
                <div className="control readonly">
                  {policyStatus.needReconsent === false ? (
                    <span className="badge success" style={{ color: '#111' }}>ĐÃ CHẤP THUẬN</span>
                  ) : (
                    <span className="badge warn">CHƯA</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <label>Thời điểm chấp thuận gần nhất</label>
                <div className="control readonly">
                  {policyStatus.lastConsentedAt
                    ? new Date(policyStatus.lastConsentedAt).toLocaleString('vi-VN')
                    : '—'}
                </div>
              </div>

              <div className="form-row">
                <label>Yêu cầu đồng ý lại</label>
                <div className="control readonly">{policyStatus.needReconsent ? 'Có' : 'Không'}</div>
              </div>

              <div className="form-row">
                <label>PDF hiện hành</label>
                <div className="control readonly">
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
        </section>

        {/* Footer actions */}
        <div className="wk-form-footer">
          <div className="wk-actions">
            <button
              className="btn-mono ghost"
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              ← Quay lại
            </button>

            <button
              className="btn-mono red"
              type="button"
              onClick={openReject}
              disabled={submitting}
              title="Từ chối hồ sơ này"
            >
              Từ chối
            </button>

            <button
              className="btn-mono black"
              onClick={approveSeller}
              disabled={submitting}
              title="Duyệt hồ sơ này"
            >
              {submitting ? 'Đang xử lý…' : 'Duyệt'}
            </button>
          </div>
        </div>
      </div>

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
                onClick={sendReject}
                disabled={submitting}
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
