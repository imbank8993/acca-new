import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface InlineAlertProps {
    message: string
    type?: 'success' | 'error' | 'info'
    onClose: () => void
    duration?: number
}

export default function InlineAlert({ message, type = 'success', onClose, duration = 5000 }: InlineAlertProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration)
        return () => clearTimeout(timer)
    }, [onClose, duration])

    const bg = type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #2563eb)'
    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : 'i'

    const el = (
        <div
            style={{
                position: 'fixed',
                top: 24,
                right: 24,
                zIndex: 9999,
                minWidth: 300,
                maxWidth: 480,
                background: bg,
                color: '#fff',
                borderRadius: 14,
                padding: '14px 20px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                animation: 'inlineAlertSlide 0.3s ease',
                cursor: 'pointer',
            }}
            onClick={onClose}
            title="Klik untuk menutup"
        >
            <span style={{
                width: 24, height: 24,
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
            }}>
                {icon}
            </span>
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
            <button
                onClick={(e: any) => { e.stopPropagation(); onClose() }}
                style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1,
                    flexShrink: 0, alignSelf: 'flex-start',
                }}
            >×</button>
            <style>{`
                @keyframes inlineAlertSlide {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    )

    return createPortal(el, document.body)
}
