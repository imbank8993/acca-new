'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react'
import { applyThemeColor } from '@/lib/theme-color'

interface ModalContextType {
  isAnyModalOpen: boolean
  registerModal: () => () => void
  openModal: () => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType>({
  isAnyModalOpen: false,
  registerModal: () => () => {},
  openModal: () => {},
  closeModal: () => {},
})

export function useModalBlur() {
  return useContext(ModalContext)
}

export function ModalBlurProvider({ children }: { children: ReactNode }) {
  const [manualModalCount, setManualModalCount] = useState(0)
  const [isSwalOpen, setIsSwalOpen] = useState(false)

  const openModal = useCallback(() => {
    setManualModalCount(prev => prev + 1)
  }, [])

  const closeModal = useCallback(() => {
    setManualModalCount(prev => Math.max(0, prev - 1))
  }, [])

  const registerModal = useCallback(() => {
    setManualModalCount(prev => prev + 1)
    return () => setManualModalCount(prev => Math.max(0, prev - 1))
  }, [])

  // Auto-detect SweetAlert2 and other modals appended to body
  useEffect(() => {
    if (typeof document === 'undefined') return

    const checkSwal = () => {
      // swal2-shown class on body is the most reliable indicator
      const hasSwalClass = document.body.classList.contains('swal2-shown');
      // Fallback: check if container is in DOM and not hidden
      const swalContainer = document.querySelector('.swal2-container');
      const isVisible = swalContainer && !swalContainer.classList.contains('swal2-hidden') && getComputedStyle(swalContainer).display !== 'none';
      
      setIsSwalOpen(hasSwalClass || !!isVisible);
    }

    const observer = new MutationObserver(checkSwal)

    observer.observe(document.body, { 
      childList: true, 
      subtree: false,
      attributes: true,
      attributeFilter: ['class']
    })

    // Initial check
    checkSwal();

    return () => observer.disconnect()
  }, [])

  const isAnyModalOpen = useMemo(() => {
    return manualModalCount > 0 || isSwalOpen
  }, [manualModalCount, isSwalOpen])

  // Bilah status HP (baterai/jaringan) ikut warna lapisan yang sedang menutupi
  // halaman — lihat lib/theme-color.ts. Dipasang di sini karena provider inilah
  // satu-satunya tempat yang sudah tahu ada-tidaknya modal, di seluruh halaman.
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Satu frame setelah render: overlay baru menempel ke DOM dan warnanya baru
    // bisa dibaca setelah browser menghitung gaya. Membacanya lebih awal
    // menghasilkan warna kanvas, bukan warna overlay.
    const raf = requestAnimationFrame(() => { applyThemeColor() })

    // Kelas `dark` di <html> berubah runtime lewat tombol tema; warna kanvas
    // ikut berubah, jadi hitung ulang.
    const themeObserver = new MutationObserver(() => applyThemeColor())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      cancelAnimationFrame(raf)
      themeObserver.disconnect()
    }
  }, [isAnyModalOpen])

  const contextValue = useMemo(
    () => ({
      isAnyModalOpen,
      registerModal,
      openModal,
      closeModal
    }),
    [isAnyModalOpen, registerModal, openModal, closeModal]
  )

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
    </ModalContext.Provider>
  )
}
