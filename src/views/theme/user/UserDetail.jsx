import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader, CRow, CCol,
  CListGroup, CListGroupItem, CSpinner, CBadge, CAlert,
  CModal, CModalHeader, CModalBody, CModalFooter, CModalTitle, CButton,
} from '@coreui/react'
import { AuthContext } from 'src/contexts/AuthContext'
import { getUserDetail, getSellerByUserId, deleteUsers } from 'src/services/adminUsers'
import { showToast } from 'src/lib/toast-bus'
import '../../theme/user/users-bw.css'

const REQUIRED_PHRASE = 'xóa người dùng'

// Helper: nhận diện AbortError để bỏ qua
const isAbortError = (err) =>
  err?.name === 'AbortError' ||
  err?.code === 20 ||
  /aborted|abort/i.test(err?.message || '')

const Item = ({ label, children }) => (
  <CListGroupItem className="d-flex justify-content-between align-items-start">
    <div className="fw-semibold">{label}</div>
    <div className="text-end" style={{ maxWidth: '70%' }}>{children ?? '-'}</div>
  </CListGroupItem>
)

export default function UserDetail() {
  const { id } = useParams() // userId
  const navigate = useNavigate()
  const { authFetch, isAuthenticated } = useContext(AuthContext)

  const [data, setData] = useState(null)      // profile
  const [seller, setSeller] = useState(null)  // seller info
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')

  // modal xác nhận có ô nhập
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    const ctrl = new AbortController()

    ;(async () => {
      setLoading(true); setErr('')
      try {
        // 1) Profile
        const res = await getUserDetail(authFetch, id, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setData(res)

        // 2) Seller (nếu có)
        try {
          const s = await getSellerByUserId(authFetch, id, { signal: ctrl.signal })
          if (ctrl.signal.aborted) return
          setSeller(s ?? null)
        } catch (e) {
          if (isAbortError(e)) return
          setSeller(null)
        }
      } catch (e) {
        if (isAbortError(e)) return
        setErr(e.message || 'Tải người dùng thất bại')
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    })()

    return () => ctrl.abort()
  }, [id, isAuthenticated, authFetch])

  const fullName = `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim()
  const statusBadge = (status) => {
    if (status === 'AVAILABLE' || status === true) return <CBadge className="bw-badge-available">khả dụng</CBadge>
    if (status === 'UNAVAILABLE' || status === false) return <CBadge className="bw-badge-unavailable">không khả dụng</CBadge>
    return <CBadge className="bw-badge-unknown">không rõ</CBadge>
  }

  const openConfirm = () => {
    setConfirmInput('')
    setConfirmOpen(true)
  }

  const doDelete = async () => {
    if (!data?.id) return
    if (confirmInput.trim() !== REQUIRED_PHRASE) {
      showToast?.({
        title: 'Sai cụm xác nhận',
        text: `Bạn cần nhập đúng: ${REQUIRED_PHRASE}`,
        type: 'error',
        duration: 3000,
      })
      return
    }
    try {
      setActionErr('')
      setDeleting(true)

      await deleteUsers(authFetch, [data.id])

      showToast?.({
        title: 'Đã xoá',
        text: `Xoá thành công người dùng ${data.id}`,
        type: 'success',
        duration: 2500,
      })

      navigate('/users')
    } catch (e) {
      if (isAbortError(e)) return
      setActionErr(e.message || 'Xóa thất bại')
      showToast?.({
        title: 'Xoá thất bại',
        text: e?.message || 'Vui lòng thử lại sau.',
        type: 'error',
        duration: 3500,
      })
    } finally {
      setDeleting(false)
    }
  }

  const canConfirm = confirmInput.trim() === REQUIRED_PHRASE

  return (
    <div className="fade-in" style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <CCard className="bw-card">
        <CCardHeader className="bw-header d-flex align-items-center justify-content-between">
          <strong style={{ color: '#111827' }}>Chi tiết người dùng</strong>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <button className="bw-btn-ghost" onClick={() => navigate(-1)}>Quay lại</button>

            {/* Nút xoá kiểu BrowseUsers: icon trash nét mảnh */}
            <button
              type="button"
              className="view-icon-btn danger bw-compact"
              onClick={openConfirm}
              title="Xoá người dùng"
              aria-label="Xoá người dùng"
            >
              <svg className="view-ic-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 6h18M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                  stroke="#111827"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M10 11v6M14 11v6" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </CCardHeader>
      </CCard>

      {actionErr && <CAlert color="danger" className="mb-0">{actionErr}</CAlert>}

      {/* Khối A: Thông tin người dùng */}
      <CCard className="bw-card">
        <CCardHeader className="bw-header">
          <strong style={{ color: '#111827' }}>Thông tin người dùng</strong>
        </CCardHeader>
        <CCardBody>
          {err && <div className="text-danger mb-2">{err}</div>}
          {loading ? (
            <div className="py-5 text-center"><CSpinner /></div>
          ) : (
            <>
              <CRow className="mb-3">
                <CCol md={6}>
                  <CListGroup flush>
                    <Item label="ID người dùng">{String(data?.id ?? '')}</Item>
                    <Item label="ID tài khoản">{String(data?.account_id ?? '')}</Item>
                    <Item label="Họ tên">{fullName || '-'}</Item>
                    <Item label="Email">{seller?.email ? seller.email : <span className="text-muted">-</span>}</Item>
                    <Item label="Số điện thoại">{data?.phone ?? '-'}</Item>
                    <Item label="Trạng thái">{statusBadge(data?.status)}</Item>
                  </CListGroup>
                </CCol>

                <CCol md={6}>
                  <CListGroup flush>
                    <Item label="Hạng">{data?.tier ?? '-'}</Item>
                    <Item label="Điểm tích lũy">{String(data?.points ?? 0)}</Item>
                    <Item label="Ngày sinh">{data?.birthdate ?? '-'}</Item>
                    <Item label="Ảnh đại diện">
                      {data?.public_id ? (
                        <img src={data.public_id} alt="avatar" className="bw-avatar" />
                      ) : '-' }
                    </Item>
                    <Item label="Ngày tạo">
                      {data?.created_time ? new Date(data.created_time).toLocaleString() : '-'}
                    </Item>
                    <Item label="Cập nhật">
                      {data?.modified_time ? new Date(data.modified_time).toLocaleString() : '-'}
                    </Item>
                  </CListGroup>
                </CCol>
              </CRow>

              <CRow className="g-3">
                <CCol md={6}>
                  <div
                    className="fade-in"
                    style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}
                  >
                    <h6 className="fw-bold mb-2" style={{ color: '#111827' }}>Địa chỉ</h6>
                    {(data?.addresses?.length ? data.addresses : []).map((a, i) => (
                      <div key={i} className="addr-item">
                        <span className="addr-bullet">{i + 1}</span>
                        <div>
                          {a.address}{' '}
                          {a.is_default ? <CBadge className="bw-badge-available ms-2">mặc định</CBadge> : null}
                        </div>
                      </div>
                    ))}
                    {!data?.addresses?.length && <div className="text-muted">-</div>}
                  </div>
                </CCol>

                <CCol md={6}>
                  <div
                    className="fade-in"
                    style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}
                  >
                    <h6 className="fw-bold mb-2" style={{ color: '#111827' }}>Sản phẩm yêu thích</h6>
                    {Array.isArray(data?.favorite_products) && data.favorite_products.length ? (
                      <pre className="bw-pre p-3">{data.favorite_products.join(', ')}</pre>
                    ) : (
                      <div className="text-muted">-</div>
                    )}
                  </div>
                </CCol>
              </CRow>
            </>
          )}
        </CCardBody>
      </CCard>

      {/* Khối B: Thông tin người bán (nếu có) */}
      {seller && (
        <CCard className="bw-card">
          <CCardHeader className="bw-header">
            <strong style={{ color: '#111827' }}>Thông tin người bán</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="mb-2">
              <CCol md={6}>
                <CListGroup flush>
                  <Item label="Email">{seller.email ?? '-'}</Item>
                  <Item label="Tên gian hàng">{seller.shop_name ?? '-'}</Item>
                  <Item label="Trạng thái">
                    <CBadge className="bw-badge-unknown">{seller.status ?? '-'}</CBadge>
                  </Item>
                </CListGroup>
              </CCol>
              <CCol md={6}>
                <CListGroup flush>
                  <Item label="Địa chỉ gian hàng">{seller.address ?? '-'}</Item>
                  <Item label="Số dư ví">{String(seller.wallet ?? 0)}</Item>
                  <Item label="Ảnh gian hàng">
                    {seller.avatar_link ? <img src={seller.avatar_link} alt="shop-avatar" className="bw-avatar" /> : '-'}
                  </Item>
                </CListGroup>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      )}

      {/* Modal xác nhận có ô nhập */}
      <CModal
        visible={confirmOpen}
        onClose={() => (!deleting ? setConfirmOpen(false) : null)}
        alignment="center"
        size="md"
        scrollable
      >
        <CModalHeader>
          <CModalTitle>Xác nhận xoá người dùng</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-2">
            Bạn sắp xoá người dùng: <b>{data?.id}</b>
          </p>
          <p>Vui lòng nhập chính xác cụm sau để tiếp tục:</p>
          <div className="mb-2">
            <code style={{ padding: '2px 6px', borderRadius: 6, background: '#f3f4f6' }}>
              {REQUIRED_PHRASE}
            </code>
          </div>
          <input
            type="text"
            className="form-control"
            placeholder={REQUIRED_PHRASE}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={deleting}
            spellCheck={false}
            autoCapitalize="off"
          />
          <div className="pl-hint mt-2">
            <small>
              Gợi ý: Nhấn <b>Ctrl/⌘ + Enter</b> để xác nhận nhanh
            </small>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Huỷ
          </CButton>
          <CButton color="danger" onClick={doDelete} disabled={!canConfirm || deleting}>
            {deleting ? 'Đang xoá…' : 'Tiếp tục'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
