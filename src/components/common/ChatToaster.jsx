import React, { useEffect, useState } from 'react'
import './ChatToaster.css'

/**
 * ChatToaster.jsx
 * - Lắng nghe các event:
 *   - app-toast            { id, title, text, type, duration }
 *   - app-toast-dismiss    { id }
 *   - app-confirm          { id, title, text, confirmText, cancelText, type }
 * - Phát lại câu trả lời confirm bằng event "app-confirm-answer" { id, ok }
 *
 * Dùng chung được với toast bus bạn đã có (window.__appToastBus).
 */

export default function ChatToaster({
  position = 'top-right',    // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxToasts = 5,             // giới hạn số toast hiển thị đồng thời
}) {
  const [toasts, setToasts] = useState([])
  const [confirmBox, setConfirmBox] = useState(null) // {id,title,text,confirmText,cancelText,type}

  // Lắng nghe event bus
  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail
      setToasts((list) => {
        const next = [...list, t].slice(-maxToasts)
        return next
      })
      if (t.duration !== 0) {
        const ms = t.duration ?? 2500
        setTimeout(() => {
          setToasts((list) => list.filter((x) => x.id !== t.id))
        }, ms)
      }
    }

    const onToastDismiss = (e) => {
      const { id } = e.detail || {}
      setToasts((list) => list.filter((x) => x.id !== id))
    }

    const onConfirm = (e) => {
      setConfirmBox(e.detail) // {id,title,text,confirmText,cancelText,type}
    }

    window.addEventListener('app-toast', onToast)
    window.addEventListener('app-toast-dismiss', onToastDismiss)
    window.addEventListener('app-confirm', onConfirm)
    return () => {
      window.removeEventListener('app-toast', onToast)
      window.removeEventListener('app-toast-dismiss', onToastDismiss)
      window.removeEventListener('app-confirm', onConfirm)
    }
  }, [maxToasts])

  // trả lời confirm
  const answerConfirm = (ok) => {
    if (!confirmBox?.id) return
    window.dispatchEvent(new CustomEvent('app-confirm-answer', { detail: { id: confirmBox.id, ok } }))
    setConfirmBox(null)
  }

  // phím tắt cho confirm
  useEffect(() => {
    if (!confirmBox) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); answerConfirm(false) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') { e.preventDefault(); answerConfirm(true) }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); answerConfirm(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmBox])

  // vị trí stack
  const stackClass = `ct-stack ${position}`

  return (
    <>
      {/* Toast list */}
      <div className={stackClass}>
        {toasts.map((t) => (
          <div key={t.id} className={`ct-toast ${t.type || 'info'}`} role="status" aria-live="polite">
            <div className="ct-toast-row">
              <div className="ct-toast-body">
                <div className="ct-title">{t.title}</div>
                {t.text ? <div className="ct-text">{t.text}</div> : null}
              </div>
              <button
                className="ct-x"
                aria-label="Đóng"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmBox && (
        <div
          className="ct-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && answerConfirm(false)}
        >
          <div className="ct-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="ct-modal-title">{confirmBox.title || 'Xác nhận'}</h3>
            {confirmBox.text ? <p className="ct-modal-text">{confirmBox.text}</p> : null}

            <div className="ct-modal-actions">
              <button className="ct-btn ghost" onClick={() => answerConfirm(false)}>
                {confirmBox.cancelText || 'Hủy'}
              </button>
              <button className="ct-btn danger" onClick={() => answerConfirm(true)}>
                {confirmBox.confirmText || 'Đồng ý'}
              </button>
            </div>

            <div className="ct-modal-hint">
              <small>Nhấn <b>Enter</b> để đồng ý · <b>Esc</b> để hủy</small>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
