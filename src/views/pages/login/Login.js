import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormCheck,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilShieldAlt } from '@coreui/icons'
import './login-effects.css'

const Login = () => {
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', remember: true })

  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!form.username || !form.password) return
    setLoading(true)
    setTimeout(() => navigate('/', { replace: true }), 700) // demo
  }

  return (
    <div className="login-page min-vh-100 d-flex flex-row align-items-center">
      {/* Nền hiệu ứng */}
      <div className="orbs">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="orb orb-4" />
      </div>

      <CContainer>
        <CRow className="justify-content-center">
          <CCol xs={12} sm={10} md={8} lg={6} xl={5}>
            <CCard className="p-4 card-glass shadow-2xl login-card-center">
              <CCardBody>
                <div className="text-center mb-3 fade-up">
                  <div className="brand-badge mx-auto mb-3">
                    <CIcon icon={cilShieldAlt} size="lg" />
                  </div>
                  <h1 className="m-0 fw-bold login-title">Đăng nhập quản trị</h1>
                  <p className="text-body-secondary mt-2 login-subtitle">
                    Quản lý sản phẩm, đơn hàng, người dùng và báo cáo
                  </p>
                </div>

                <CForm onSubmit={onSubmit} className="login-form" noValidate>
                  <div className="stack-gap">
                    <CInputGroup className="input-anim fade-up">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        placeholder="Email hoặc Tên đăng nhập"
                        autoComplete="username"
                        name="username"
                        value={form.username}
                        onChange={onChange}
                        required
                      />
                    </CInputGroup>

                    <div className="position-relative fade-up">
                      <CInputGroup className="input-anim has-toggle">
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput
                          type={showPwd ? 'text' : 'password'}
                          placeholder="Mật khẩu"
                          autoComplete="current-password"
                          name="password"
                          value={form.password}
                          onChange={onChange}
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          className="toggle-pwd"
                          onClick={() => setShowPwd((s) => !s)}
                          aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPwd ? 'Ẩn' : 'Hiện'}
                        </button>
                      </CInputGroup>
                    </div>

                    <div className="d-flex justify-content-center fade-up">
                      <CFormCheck
                        id="remember"
                        name="remember"
                        label="Ghi nhớ đăng nhập"
                        checked={form.remember}
                        onChange={onChange}
                      />
                    </div>

                    <div className="text-center fade-up">
                      <CButton
                        color="primary"
                        className="px-4 btn-cta btn-wide"
                        size="lg"
                        type="submit"
                        disabled={loading}
                        onMouseMove={(e) => {
                          const r = e.currentTarget.getBoundingClientRect()
                          e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
                          e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
                        }}
                      >
                        {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
                      </CButton>
                    </div>

                    <div className="text-center">
                      <button type="button" className="link-ghost fade-up small">
                        Quên mật khẩu?
                      </button>
                    </div>
                  </div>

                  <div className="hint small text-center text-body-secondary mt-3 fade-up">
                    * Giao diện demo – chưa nối API.
                  </div>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
