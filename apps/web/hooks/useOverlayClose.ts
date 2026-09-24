import { useRef, useCallback } from 'react'

/**
 * Overlay backdrop click-to-close, tanpa bug "modal tertutup sendiri".
 *
 * Masalah: overlay biasa pakai `onClick={() => onClose()}` di backdrop +
 * `onClick={e => e.stopPropagation()}` di konten modal. Tapi kalau user
 * mulai drag/seleksi teks di dalam input (mousedown di konten) lalu
 * melepas klik di luar batas konten (mouseup di backdrop), browser tetap
 * memicu satu event "click" di ancestor bersama (backdrop) — stopPropagation
 * di konten tidak menahannya karena click itu tidak "lewat" dari konten,
 * targetnya sudah backdrop. Modal pun tertutup padahal user cuma
 * menyeleksi teks/menyeret dari dalam form.
 *
 * Fix: hanya tutup modal kalau mousedown DAN click sama-sama terjadi
 * langsung di backdrop (bukan hasil drag dari elemen anak).
 */
export function useOverlayClose(onClose: () => void) {
  const downOnOverlay = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    downOnOverlay.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (downOnOverlay.current && e.target === e.currentTarget) {
      onClose()
    }
    downOnOverlay.current = false
  }, [onClose])

  return { onMouseDown, onClick }
}
