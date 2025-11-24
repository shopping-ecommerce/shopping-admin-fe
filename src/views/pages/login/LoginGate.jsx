import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Login from './Login'
import './login-intro.css'

export default function LoginGate() {
  const [showIntro, setShowIntro] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const timerRef = useRef(null)

  const location = useLocation()
  const navigate = useNavigate()

  // Lấy tham số redirect, ví dụ ?redirect=/dashboard
  const params = new URLSearchParams(location.search)
  const redirectAfterIntro = params.get('/dashboard') // có thể là '/', '/dashboard', v.v.

  const goAfterIntro = () => {
    if (redirectAfterIntro) {
      // Có yêu cầu chuyển thẳng: Intro → Trang đích
      setFadeOut(true)
      setTimeout(() => navigate(redirectAfterIntro, { replace: true }), 400)
    } else {
      // Không có redirect: Intro → Form Login (hành vi cũ)
      setFadeOut(true)
      setTimeout(() => setShowIntro(false), 400)
    }
  }

  // Fallback: nếu onAnimationEnd không bắn, vẫn đảm bảo đóng Intro
  useEffect(() => {
    if (!showIntro) return
    timerRef.current = setTimeout(() => {
      goAfterIntro()
    }, 3600) // khớp duration intro của bạn
    return () => clearTimeout(timerRef.current)
  }, [showIntro]) // eslint-disable-line

  return (
    <div className="intro-gate">
      {showIntro ? (
        <IntroScene
          fading={fadeOut}
          onFinish={goAfterIntro}
          onSkip={() => {
            clearTimeout(timerRef.current)
            goAfterIntro()
          }}
        />
      ) : (
        <div className="intro-fade-in">
          <Login />
        </div>
      )}
    </div>
  )
}

function IntroScene({ onFinish, onSkip, fading }) {
  return (
    <div className={`intro-screen ${fading ? 'is-fading' : ''}`}>
      <div className="intro-bg">
        <div className="layer skyline" />
        <div className="layer floor" />
      </div>
      <div className="intro-title">
        <h1>Admin Console</h1>
        <p>Đang khởi tạo bảng điều khiển…</p>
      </div>
      <div className="cart-track">
        <CartAndPerson onFinish={onFinish} />
      </div>
      <button className="intro-skip" onClick={onSkip} aria-label="Bỏ qua intro">
        Bỏ qua
      </button>
    </div>
  )
}

function CartAndPerson({ onFinish }) {
  return (
    <svg
      className="cart-svg run-across"
      viewBox="0 0 400 180"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      onAnimationEnd={onFinish}
    >
      <ellipse cx="120" cy="150" rx="90" ry="10" className="shadow" />
      <g className="person">
        <circle cx="70" cy="60" r="16" className="skin" />
        <path d="M60,78 L80,78 L86,110 L70,110 Z" className="shirt" />
        <path d="M70,110 L62,148 M80,110 L88,148" className="leg" />
        <path d="M78,82 L120,90" className="arm" />
      </g>
      <g className="cart">
        <rect x="120" y="80" width="120" height="50" rx="6" className="cart-body" />
        <line x1="130" y1="80" x2="130" y2="130" className="cart-grid" />
        <line x1="150" y1="80" x2="150" y2="130" className="cart-grid" />
        <line x1="170" y1="80" x2="170" y2="130" className="cart-grid" />
        <line x1="190" y1="80" x2="190" y2="130" className="cart-grid" />
        <line x1="210" y1="80" x2="210" y2="130" className="cart-grid" />
        <line x1="120" y1="95" x2="240" y2="95" className="cart-grid" />
        <line x1="120" y1="110" x2="240" y2="110" className="cart-grid" />
        <line x1="120" y1="90" x2="100" y2="85" className="handle" />
        <circle cx="140" cy="136" r="10" className="wheel" />
        <circle cx="220" cy="136" r="10" className="wheel" />
        <circle cx="140" cy="136" r="4" className="wheel-center" />
        <circle cx="220" cy="136" r="4" className="wheel-center" />
        <rect x="130" y="72" width="26" height="10" className="box box-1" />
        <rect x="160" y="68" width="30" height="14" className="box box-2" />
        <rect x="194" y="70" width="24" height="12" className="box box-3" />
      </g>
      <g className="dust">
        <circle cx="115" cy="142" r="2" />
        <circle cx="108" cy="144" r="1.5" />
        <circle cx="100" cy="146" r="1" />
      </g>
    </svg>
  )
}
