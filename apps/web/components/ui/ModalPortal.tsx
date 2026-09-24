'use client';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
    children: ReactNode;
    isOpen: boolean;
    onClose?: () => void;
    showBackdrop?: boolean;
    className?: string;
}

export default function ModalPortal({
    children,
    isOpen,
    onClose,
    showBackdrop = true,
    className = ''
}: ModalPortalProps) {
    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <>
            {showBackdrop && onClose && (
                <div
                    className={`modal-portal-backdrop ${className}`}
                    onClick={onClose}
                />
            )}
            {children}
        </>,
        document.body
    );
}
