'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './alert.css'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

export interface AlertOptions {
  title?: string
  type?: AlertType
  confirmText?: string
  cancelText?: string
  isConfirm?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

export interface ToastItem {
  id: string
  message: string
  title?: string
  type: AlertType
  duration?: number
}

interface AlertContextType {
  showAlert: (message: string, options?: AlertOptions) => Promise<boolean>
  showConfirm: (message: string, options?: AlertOptions) => Promise<boolean>
  showToast: (message: string, options?: { title?: string; type?: AlertType; duration?: number }) => void
  showSuccess: (message: string, title?: string) => void
  showError: (message: string, title?: string) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [alertState, setAlertState] = useState<{
    isOpen: boolean
    message: string
    title?: string
    type: AlertType
    confirmText: string
    cancelText: string
    isConfirm: boolean
    resolve?: (value: boolean) => void
  }>({
    isOpen: false,
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Batal',
    isConfirm: false,
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show Alert Dialog (returns Promise)
  const showAlert = useCallback((message: string, options?: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      // Automatic detection of error vs success type based on content if not passed
      let defaultType: AlertType = options?.type || 'info'
      if (!options?.type) {
        const lower = message.toLowerCase()
        if (lower.includes('berhasil') || lower.includes('sukses')) defaultType = 'success'
        else if (lower.includes('gagal') || lower.includes('terjadi kesalahan') || lower.includes('error') || lower.includes('wajib')) defaultType = 'error'
      }

      setAlertState({
        isOpen: true,
        message,
        title: options?.title || (defaultType === 'success' ? 'Berhasil' : defaultType === 'error' ? 'Pemberitahuan' : 'Informasi'),
        type: defaultType,
        confirmText: options?.confirmText || 'OK',
        cancelText: options?.cancelText || 'Batal',
        isConfirm: !!options?.isConfirm,
        resolve,
      })
    })
  }, [])

  // Show Confirm Dialog
  const showConfirm = useCallback((message: string, options?: AlertOptions): Promise<boolean> => {
    return showAlert(message, {
      title: options?.title || 'Konfirmasi',
      type: options?.type || 'warning',
      confirmText: options?.confirmText || 'Ya, Lanjutkan',
      cancelText: options?.cancelText || 'Batal',
      isConfirm: true,
      ...options,
    })
  }, [showAlert])

  // Show Floating Toast
  const showToast = useCallback((message: string, options?: { title?: string; type?: AlertType; duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9)
    const type = options?.type || 'success'
    const duration = options?.duration || 4000

    const newToast: ToastItem = {
      id,
      message,
      title: options?.title || (type === 'success' ? 'Berhasil' : type === 'error' ? 'Error' : 'Info'),
      type,
      duration,
    }

    setToasts((prev) => [...prev, newToast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast(message, { type: 'success', title })
  }, [showToast])

  const showError = useCallback((message: string, title?: string) => {
    showToast(message, { type: 'error', title })
  }, [showToast])

  // Monkey-patch window.alert and window.confirm to seamlessly upgrade legacy native browser popups
  useEffect(() => {
    if (typeof window === 'undefined') return

    const originalAlert = window.alert
    const originalConfirm = window.confirm

    window.alert = (msg?: any) => {
      showAlert(String(msg || ''))
    }

    window.confirm = (msg?: any): boolean => {
      // Since native confirm is synchronous but React state is async,
      // we show our sleek dialog asynchronously.
      showConfirm(String(msg || ''))
      return true
    }

    return () => {
      window.alert = originalAlert
      window.confirm = originalConfirm
    }
  }, [showAlert, showConfirm])

  const handleConfirm = () => {
    if (alertState.resolve) alertState.resolve(true)
    setAlertState((prev) => ({ ...prev, isOpen: false }))
  }

  const handleCancel = () => {
    if (alertState.resolve) alertState.resolve(false)
    setAlertState((prev) => ({ ...prev, isOpen: false }))
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Icons based on type
  const getIconClass = (type: AlertType) => {
    switch (type) {
      case 'success': return 'bi bi-check-circle-fill'
      case 'error': return 'bi bi-x-circle-fill'
      case 'warning': return 'bi bi-exclamation-triangle-fill'
      case 'info': default: return 'bi bi-info-circle-fill'
    }
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showToast, showSuccess, showError }}>
      {children}

      {/* Render Alert Modal via Portal */}
      {mounted && alertState.isOpen && createPortal(
        <div className="el-alert__overlay" onClick={handleCancel}>
          <div className="el-alert__card" onClick={(e) => e.stopPropagation()}>
            <div className={`el-alert__iconWrap ${alertState.type}`}>
              <i className={getIconClass(alertState.type)} />
            </div>

            <div className="el-alert__title">{alertState.title}</div>
            <div className="el-alert__message">{alertState.message}</div>

            <div className="el-alert__actions">
              {alertState.isConfirm && (
                <button
                  type="button"
                  className="el-alert__btn el-alert__btnSecondary"
                  onClick={handleCancel}
                >
                  {alertState.cancelText}
                </button>
              )}
              <button
                type="button"
                className={`el-alert__btn el-alert__btnPrimary ${alertState.type}`}
                onClick={handleConfirm}
                autoFocus
              >
                {alertState.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Render Toast Notifications via Portal */}
      {mounted && toasts.length > 0 && createPortal(
        <div className="el-toast__container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="el-toast__card"
              onClick={() => removeToast(toast.id)}
            >
              <div className={`el-toast__icon ${toast.type}`}>
                <i className={getIconClass(toast.type)} />
              </div>
              <div className="el-toast__content">
                {toast.title && <div className="el-toast__title">{toast.title}</div>}
                <div className="el-toast__msg">{toast.message}</div>
              </div>
              <button
                type="button"
                className="el-toast__close"
                onClick={(e) => {
                  e.stopPropagation()
                  removeToast(toast.id)
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}
