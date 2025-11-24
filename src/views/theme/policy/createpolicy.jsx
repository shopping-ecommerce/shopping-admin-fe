import React, { useEffect, useMemo, useState, useContext } from 'react'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CForm,
  CFormInput, CFormLabel, CFormTextarea, CInputGroup, CInputGroupText,
  CRow, CSpinner
} from '@coreui/react'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import { AuthContext } from 'src/contexts/AuthContext'
import { API_CONFIG, apiUrl } from 'src/config/api'
import './Policy.css'

/* ===== Driver.js (tour) ===== */
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/** ==== Cấu hình BE ==== */
const POLICY_CODE = 'seller-tos'
const MIN_LEN = 30 // tối thiểu 30 ký tự để publish

/** Tương thích cả 2 kiểu export apiUrl: function(path) hoặc string baseUrl */
const makeUrl = (path) => {
  if (typeof apiUrl === 'function') return apiUrl(path)
  const base = (typeof apiUrl === 'string' && apiUrl) ? apiUrl : (API_CONFIG?.baseUrl || '')
  return `${base}${path}`
}

/** Header bổ sung (Authorization đã do authFetch gắn) */
const buildExtraHeaders = (userId) => {
  const h = { 'Content-Type': 'application/json' }
  if (userId) h['X-User-Id'] = userId
  return h
}

/** API: lấy DRAFT (nếu không có sẽ trả 404) */
const fetchDraft = async (authFetch, userId) => {
  const url = makeUrl(`/policy/policies/${POLICY_CODE}/draft`)
  const res = await authFetch(url, { headers: buildExtraHeaders(userId) })
  if (res.status === 401) throw new Error('UNAUTH')
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Fetch draft failed')
  return res.json()
}

/** API: lưu DRAFT */
const saveDraft = async (authFetch, payload, userId) => {
  const url = makeUrl(`/policy/policies/${POLICY_CODE}/draft`)
  const res = await authFetch(url, {
    method: 'POST',
    headers: buildExtraHeaders(userId),
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('UNAUTH')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Save draft failed')
  }
  return res.json().catch(() => ({}))
}

/** API: lấy policy hiện hành (markdown) */
const fetchCurrentPolicy = async (authFetch, userId) => {
  const url = makeUrl(`/policy/policies/${POLICY_CODE}/current`)
  const res = await authFetch(url, { headers: buildExtraHeaders(userId) })
  if (res.status === 401) throw new Error('UNAUTH')
  if (!res.ok) throw new Error('Fetch current policy failed')
  return res.json()
}

/** API: publish-now (KHÔNG còn requireReconsent) */
const publishNow = async (authFetch, payload, userId) => {
  const url = makeUrl(`/policy/policies/${POLICY_CODE}/publish-now`)
  const res = await authFetch(url, {
    method: 'POST',
    headers: buildExtraHeaders(userId),
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('UNAUTH')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Publish failed')
  }
  return res.json().catch(() => ({}))
}

const Policy = () => {
  const auth = useContext(AuthContext)
  const { authFetch, isAuthenticated, user, logout } = auth || {}

  const currentUserId = user?.id || 'admin_001'

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState('')
  const [draftOk, setDraftOk]   = useState('')

  const [isDraftView, setIsDraftView] = useState(false) // đang hiển thị từ draft
  const [form, setForm] = useState({
    startDate: '',            // YYYY-MM-DD
    commissionPercent: 8.0,
    changeNotes: '',
    contentMd: '',
  })

  const [displayVersion, setDisplayVersion] = useState('') // chỉ hiển thị, không gửi lên BE

  const contentOk = (form.contentMd?.trim()?.length || 0) >= MIN_LEN

  const mdToolbar = useMemo(() => ([
    'bold', 'italic', 'strike', 'code', 'quote',
    'ordered-list', 'unordered-list',
    'link', 'table', 'image',
    'title', 'divider', 'preview', 'fullscreen'
  ]), [])

  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !authFetch) {
          setErr('Bạn chưa đăng nhập hoặc phiên đã hết hạn.')
          setLoading(false)
          return
        }
        setLoading(true); setErr(''); setOk(''); setDraftOk('')

        // ƯU TIÊN lấy bản NHÁP
        const draft = await fetchDraft(authFetch, currentUserId)
          .catch((e) => (e?.message === 'UNAUTH' ? Promise.reject(e) : null))

        if (draft) {
          setIsDraftView(true)
          setDisplayVersion(draft.version || '')
          setForm({
            startDate: draft.startDate || draft.effectiveFrom || '',
            commissionPercent: typeof draft.commissionPercent === 'number' ? draft.commissionPercent : 8.0,
            changeNotes: draft.changeNotes || '',
            contentMd: draft.contentMd || draft.content || draft.body || '',
          })
        } else {
          // Không có draft -> lấy CURRENT
          const data = await fetchCurrentPolicy(authFetch, currentUserId)
            .catch((e) => (e?.message === 'UNAUTH' ? Promise.reject(e) : null))
          if (data) {
            setIsDraftView(false)
            setDisplayVersion(data.version || '')
            setForm({
              startDate: data.startDate || data.effectiveFrom || '',
              commissionPercent: typeof data.commissionPercent === 'number' ? data.commissionPercent : 8.0,
              changeNotes: '',
              contentMd: data.contentMd || data.content || data.body || '',
            })
          }
        }
      } catch (e) {
        if (e?.message === 'UNAUTH') {
          setErr('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
          logout?.()
        } else {
          setErr('Không tải được dữ liệu chính sách.')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [isAuthenticated, authFetch, currentUserId, logout])

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const handleSaveDraft = async () => {
    setSavingDraft(true); setErr(''); setDraftOk(''); setOk('')
    try {
      if (!isAuthenticated || !authFetch) throw new Error('UNAUTH')
      const payload = {
        contentMd: (form.contentMd || '').trim(),
        changeNotes: (form.changeNotes || '').trim(),
        commissionPercent: Number(form.commissionPercent) || 0,
        startDate: form.startDate || '',      // cho phép rỗng khi nháp
      }
      await saveDraft(authFetch, payload, currentUserId)
      setIsDraftView(true)
      setDraftOk('Đã lưu bản nháp.')
    } catch (e) {
      if (e?.message === 'UNAUTH') {
        setErr('Phiên đăng nhập đã hết hạn hoặc thiếu quyền. Vui lòng đăng nhập lại.')
        logout?.()
      } else {
        setErr(e?.message || 'Lưu nháp thất bại.')
      }
    } finally {
      setSavingDraft(false)
    }
  }

  const handlePublishNow = async () => {
    setSaving(true); setErr(''); setOk(''); setDraftOk('')
    try {
      if (!isAuthenticated || !authFetch) throw new Error('UNAUTH')
      if (!form.startDate) throw new Error('Vui lòng chọn ngày “Hiệu lực từ”.')
      if (!contentOk) throw new Error(`Nội dung quá ngắn (cần tối thiểu ${MIN_LEN} ký tự).`)

      const payload = {
        contentMd: (form.contentMd || '').trim(),
        changeNotes: (form.changeNotes || '').trim(),
        commissionPercent: Number(form.commissionPercent) || 0,
        startDate: form.startDate,
      }
      await publishNow(authFetch, payload, currentUserId)
      setOk('Xuất bản thành công — chính sách sẽ có hiệu lực theo “Hiệu lực từ”.')
    } catch (e) {
      if (e?.message === 'UNAUTH') {
        setErr('Phiên đăng nhập đã hết hạn hoặc thiếu quyền. Vui lòng đăng nhập lại.')
        logout?.()
      } else {
        setErr(e?.message || 'Xuất bản thất bại.')
      }
    } finally {
      setSaving(false)
    }
  }

  /* ========== TOUR: hướng dẫn tạo policy trên Markdown ========== */
  const runPolicyTour = () => {
    const drv = driver({
      allowClose: true,
      animate: true,
      opacity: 0.45,
      stagePadding: 8,
      onHighlightStarted: ({ element }) => {
        try { element?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
      },
    })

    const steps = [
      // Thanh công cụ của MDEditor
      {
        element: '.policy-mdeditor .w-md-editor-toolbar',
        popover: {
          title: 'Thanh công cụ Markdown',
          description:
            'Dùng các nút: **Bold**, *Italic*, ~~Strike~~, Code, Trích dẫn, Danh sách, Link, Bảng, Ảnh, Tiêu đề, Xem trước, Toàn màn hình.',
          side: 'bottom',
          align: 'start',
        },
      },
      // Ô soạn thảo (bên trái)
      {
        element: '.policy-mdeditor textarea.w-md-editor-text-input',
        popover: {
          title: 'Soạn thảo nội dung',
          description:
            'Gõ policy bằng Markdown tại đây. Văn bản bên trái được render sang ô xem trước bên phải theo thời gian thực.',
          side: 'right',
          align: 'start',
        },
      },
      // Ô xem trước (bên phải)
      {
        element: '.policy-mdeditor .w-md-editor-content',
        popover: {
          title: 'Xem trước cho người bán',
          description:
            'Bản xem trước hiển thị đúng như người bán sẽ thấy. Hãy kiểm tra bố cục, tiêu đề, bảng, link… trước khi xuất bản.',
          side: 'left',
          align: 'start',
        },
      },
      // Nút Lưu nháp
      {
        element: '[data-tour="btn-save-draft"]',
        popover: {
          title: 'Lưu nháp',
          description:
            'Lưu tạm nội dung để tiếp tục chỉnh sửa sau. Không ảnh hưởng đến bản đang áp dụng cho người bán.',
          side: 'top',
          align: 'end',
        },
      },
      // Nút Xuất bản ngay
      {
        element: '[data-tour="btn-publish-now"]',
        popover: {
          title: 'Xuất bản ngay',
          description:
            'Khi nội dung đạt yêu cầu (≥ số ký tự tối thiểu) và đã chọn “Hiệu lực từ”, hãy nhấn để phát hành chính sách.',
          side: 'top',
          align: 'end',
        },
      },
    ].filter((s) => {
      try { return !!document.querySelector(s.element) } catch { return false }
    })

    if (!steps.length) return
    drv.setSteps(steps)
    drv.drive()
  }

  // Tuỳ chọn: tự chạy tour 1 lần duy nhất cho admin mới
  useEffect(() => {
    const KEY = '__policy_tour_seen'
    if (!localStorage.getItem(KEY)) {
      setTimeout(() => {
        // chỉ auto nếu các selector đã sẵn sàng (editor đã mount)
        const ready =
          document.querySelector('.policy-mdeditor .w-md-editor-toolbar') &&
          document.querySelector('.policy-mdeditor textarea.w-md-editor-text-input') &&
          document.querySelector('.policy-mdeditor .w-md-editor-content')
        if (ready) {
          runPolicyTour()
          localStorage.setItem(KEY, '1')
        }
      }, 500)
    }
  }, [])

  return (
    <CRow className="policy-container">
      <CCol xs={12}>
        <CCard className="mb-4 policy-card">
          <CCardHeader className="d-flex justify-content-between align-items-center policy-header">
            <div className="d-flex align-items-center gap-3">
              <strong>Chính sách (Markdown)</strong>
              {isDraftView ? (
                <CBadge color="warning">Đang xem BẢN NHÁP{displayVersion ? ` • ${displayVersion}` : ''}</CBadge>
              ) : (
                <CBadge color="info">Đang xem BẢN HIỆN HÀNH{displayVersion ? ` • ${displayVersion}` : ''}</CBadge>
              )}
              <CBadge color={contentOk ? 'success' : 'secondary'}>
                {contentOk ? 'Đủ điều kiện xuất bản' : `Cần ≥ ${MIN_LEN} ký tự để xuất bản`}
              </CBadge>
            </div>
          </CCardHeader>

          <CCardBody className="policy-body">
            {err && <CAlert color="danger" className="mb-3">{err}</CAlert>}
            {ok  && <CAlert color="success" className="mb-3">{ok}</CAlert>}
            {draftOk && <CAlert color="primary" className="mb-3">{draftOk}</CAlert>}

            {loading ? (
              <div className="py-5 text-center"><CSpinner /></div>
            ) : (
              <>
                {/* ==== KHỐI THIẾT LẬP TRÊN CÙNG ==== */}
                <CForm className="row g-4 policy-top-settings">
                  <CCol md={4}>
                    <div className="policy-section">
                      <div className="policy-section-title">Thiết lập áp dụng</div>
                      <CFormLabel className="fw-semibold">Hiệu lực từ</CFormLabel>
                      <CFormInput
                        type="date"
                        value={form.startDate || ''}
                        onChange={(e) => onChange('startDate', e.target.value)}
                      />
                    </div>
                  </CCol>

                  <CCol md={4}>
                    <div className="policy-section">
                      <div className="policy-section-title">Hoa hồng</div>
                      <CFormLabel className="fw-semibold">Phần trăm hoa hồng</CFormLabel>
                      <CInputGroup>
                        <CFormInput
                          type="number" step="0.01" min="0" max="100"
                          value={form.commissionPercent}
                          onChange={(e) => onChange('commissionPercent', e.target.value)}
                        />
                        <CInputGroupText>%</CInputGroupText>
                      </CInputGroup>
                      <div className="text-body-secondary small mt-2">
                        Sàn thu {Number(form.commissionPercent) || 0}% trên giá trị đơn hàng.
                      </div>
                    </div>
                  </CCol>

                  <CCol md={4}>
                    <div className="policy-section h-100">
                      <div className="policy-section-title">Ghi chú thay đổi</div>
                      <CFormTextarea
                        rows={6}
                        placeholder="Mô tả ngắn về thay đổi lần này (hiển thị trong lịch sử)…"
                        value={form.changeNotes}
                        onChange={(e) => onChange('changeNotes', e.target.value)}
                      />
                    </div>
                  </CCol>
                </CForm>

                {/* ==== NỘI DUNG ==== */}
                <div className="mt-4">
                  <CFormLabel className="fw-semibold d-flex align-items-center justify-content-between">
                    <span>Nội dung (Markdown)</span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="policy-hint">
                        Hỗ trợ tiêu đề, danh sách, bảng, code… • <code>{(form.contentMd || '').length}</code> ký tự
                      </span>
                      {/* Nút Hướng dẫn đặt cạnh dòng Nội dung (Markdown) */}
                      <CButton
                        color="secondary"
                        variant="outline"
                        size="sm"
                        className="shadow-sm"
                        onClick={runPolicyTour}
                        title="Xem hướng dẫn soạn thảo & xuất bản"
                        data-tour="btn-open-tour"
                      >
                        ❔ Hướng dẫn
                      </CButton>
                    </div>
                  </CFormLabel>

                  <div data-color-mode="light" className="policy-mdeditor">
                    <MDEditor
                      value={form.contentMd}
                      onChange={(val) => onChange('contentMd', val ?? '')}
                      height={680}
                      visibleDragbar={false}
                      previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}
                      toolbars={mdToolbar}
                      // mặc định preview='live' (trái: editor, phải: preview)
                    />
                  </div>
                </div>

                {/* ==== THANH HÀNH ĐỘNG ==== */}
                <div className="policy-footer-actions">
                  <div className="policy-footer-inner">
                    <div className="text-body-secondary small">
                      {contentOk ? 'Nội dung đủ điều kiện xuất bản.' : `Cần tối thiểu ${MIN_LEN} ký tự để xuất bản.`}
                    </div>
                    <div className="d-flex gap-2">
                      <CButton
                        color="secondary"
                        variant="outline"
                        className="shadow-sm"
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        data-tour="btn-save-draft"
                      >
                        {savingDraft ? <><CSpinner size="sm" className="me-2" />Đang lưu…</> : 'Lưu nháp'}
                      </CButton>

                      <CButton
                        color="primary"
                        className="shadow-sm"
                        onClick={handlePublishNow}
                        disabled={saving || !contentOk}
                        data-tour="btn-publish-now"
                      >
                        {saving ? <><CSpinner size="sm" className="me-2" />Đang xuất bản…</> : 'Xuất bản ngay'}
                      </CButton>
                    </div>
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

export default Policy
