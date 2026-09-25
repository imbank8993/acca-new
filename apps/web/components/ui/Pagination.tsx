import React from 'react';

/**
 * Deret nomor halaman untuk mobile: maksimal 7 slot (angka + elipsis),
 * selalu menyertakan halaman pertama & terakhir.
 */
function getMobilePages(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
}

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    limit?: number;
    totalItems: number;
    recordCount?: number;
    itemLabel?: string;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
}

export default function Pagination({
    currentPage,
    totalPages,
    limit = 10,
    totalItems,
    recordCount,
    itemLabel = 'data',
    onPageChange,
    onLimitChange
}: PaginationProps) {
    // Sembunyikan pagination jika jumlah baris data <= 10
    if (totalItems <= 10) {
        return null;
    }

    const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endRecord = Math.min(currentPage * limit, totalItems);
    const mobilePages = getMobilePages(currentPage, Math.max(totalPages, 1));

    return (
        <div className="pagination-container">
            {/* Left: Info Text */}
            <div className="pagination-info">
                <i className="bi bi-check2-circle info-icon desktop-only"></i>
                <span className="desktop-text">
                    {recordCount !== undefined && recordCount !== totalItems ? (
                        <>Menampilkan <strong>{startRecord}–{endRecord}</strong> (<strong>{recordCount}</strong> {itemLabel}) dari <strong>{totalItems}</strong> {itemLabel}</>
                    ) : (
                        <>Menampilkan <strong>{startRecord}–{endRecord}</strong> dari <strong>{totalItems}</strong> {itemLabel}</>
                    )}
                </span>
            </div>

            {/* Right: Controls (Limit & Navigation) */}
            <div className="pagination-controls">
                {onLimitChange && (
                    <div className="limit-selector">
                        <select
                            value={limit}
                            onChange={(e) => {
                                onLimitChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            aria-label="Jumlah baris per halaman"
                        >
                            {[10, 20, 50, 100].map(size => (
                                <option key={size} value={size}>{size} / hal</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Desktop Page Numbers */}
                <div className="page-buttons desktop-pages">
                    <button
                        type="button"
                        className="btn-page btn-nav"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(currentPage - 1)}
                        title="Halaman sebelumnya"
                    >
                        <i className="bi bi-chevron-left"></i>
                    </button>

                    {totalPages > 0 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                            pageNum = i + 1;
                        } else if (currentPage <= 3) {
                            pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                        } else {
                            pageNum = currentPage - 2 + i;
                        }
                        return (
                            <button
                                key={pageNum}
                                type="button"
                                className={`btn-page ${pageNum === currentPage ? 'is-active' : ''}`}
                                onClick={() => onPageChange(pageNum)}
                            >
                                {pageNum}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="btn-page btn-nav"
                        disabled={currentPage >= totalPages || totalPages === 0}
                        onClick={() => onPageChange(currentPage + 1)}
                        title="Halaman selanjutnya"
                    >
                        <i className="bi bi-chevron-right"></i>
                    </button>
                </div>

                {/* Mobile: deret nomor halaman dalam kapsul */}
                <div className="mobile-pages">
                    <button
                        type="button"
                        className="mpg-nav"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(currentPage - 1)}
                        aria-label="Halaman sebelumnya"
                    >
                        <i className="bi bi-chevron-left"></i>
                    </button>

                    {mobilePages.map((page, idx) => (
                        page === '…' ? (
                            <span key={`gap-${idx}`} className="mpg-gap" aria-hidden="true">…</span>
                        ) : (
                            <button
                                key={page}
                                type="button"
                                className={`mpg-num ${page === currentPage ? 'is-active' : ''}`}
                                aria-current={page === currentPage ? 'page' : undefined}
                                aria-label={`Halaman ${page}`}
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </button>
                        )
                    ))}

                    <button
                        type="button"
                        className="mpg-nav"
                        disabled={currentPage >= totalPages || totalPages === 0}
                        onClick={() => onPageChange(currentPage + 1)}
                        aria-label="Halaman selanjutnya"
                    >
                        <i className="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .pagination-container {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: nowrap;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 18px;
                    border-top: 1px solid var(--n-border, rgba(226, 232, 240, 0.8));
                    background: var(--n-card, #ffffff);
                    border-radius: 0 0 16px 16px;
                    gap: 10px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .pagination-info {
                    font-size: 0.84rem;
                    color: var(--n-muted, #64748b);
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                    white-space: nowrap;
                }

                .info-icon {
                    color: #10b981;
                    font-size: 0.95rem;
                }

                .pagination-info strong {
                    color: var(--n-text, #0f172a);
                    font-weight: 700;
                }

                .pagination-controls {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                    flex-wrap: nowrap;
                }

                .limit-selector select {
                    height: 34px;
                    padding: 0 8px;
                    border-radius: 8px;
                    border: 1px solid var(--n-border, #cbd5e1);
                    outline: none;
                    background: #ffffff;
                    color: var(--n-text, #0f172a);
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                    transition: all 0.2s ease;
                }

                .limit-selector select:focus {
                    border-color: var(--n-primary, #3083FF);
                    box-shadow: 0 0 0 3px rgba(0, 56, 168, 0.12);
                }

                .page-buttons {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .btn-page {
                    min-width: 34px;
                    height: 34px;
                    padding: 0 7px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--n-border, #cbd5e1);
                    background: #ffffff;
                    color: var(--n-text, #0f172a);
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.82rem;
                    transition: all 0.15s ease;
                    user-select: none;
                }

                .btn-page:hover:not(:disabled):not(.is-active) {
                    background: #f8fafc;
                    border-color: var(--n-primary, #3083FF);
                    color: var(--n-primary, #3083FF);
                    transform: translateY(-1px);
                }

                .btn-page.is-active {
                    background: var(--n-primary, #3083FF);
                    border-color: var(--n-primary, #3083FF);
                    color: #ffffff;
                    box-shadow: 0 2px 6px rgba(0, 56, 168, 0.25);
                }

                .btn-page:disabled {
                    opacity: 0.35;
                    cursor: not-allowed;
                    background: #f8fafc;
                    border-color: #e2e8f0;
                    transform: none;
                }

                .mobile-pages {
                    display: none;
                }

                /* Dark Mode Support */
                :global(.dark) .pagination-container {
                    background: #000000;
                    border-top: 1px solid rgba(37, 99, 235, 0.4);
                }

                :global(.dark) .pagination-info {
                    color: #94a3b8;
                }

                :global(.dark) .pagination-info strong {
                    color: #f8fafc;
                }

                :global(.dark) .limit-selector select {
                    background: #000000;
                    border: 1.2px solid rgba(26, 115, 232, 0.6);
                    color: #f8fafc;
                }

                :global(.dark) .btn-page {
                    background: #000000;
                    border: 1.2px solid rgba(26, 115, 232, 0.6);
                    color: #f8fafc;
                }

                :global(.dark) .btn-page:hover:not(:disabled):not(.is-active) {
                    background: rgba(26, 115, 232, 0.15);
                    border-color: #60a5fa;
                    color: #60a5fa;
                }

                :global(.dark) .btn-page.is-active {
                    background: #1a73e8;
                    border-color: #3b82f6;
                    color: #ffffff;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.5);
                }

                :global(.dark) .btn-page:disabled {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.08);
                    color: #475569;
                }

                /* Mobile Responsive - kapsul nomor halaman berkelas & elegan */
                @media (max-width: 639px) {
                    .pagination-container {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: center !important;
                        align-items: center !important;
                        padding: 6px 14px !important;
                        min-height: 48px !important;
                        margin: 6px auto 2px auto !important;
                        background: #ffffff !important;
                        border: 1.5px solid var(--n-border, rgba(226, 232, 240, 0.9)) !important;
                        border-radius: 9999px !important;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02) !important;
                        width: fit-content !important;
                        max-width: calc(100vw - 32px) !important;
                        box-sizing: border-box !important;
                        gap: 0 !important;
                    }

                    .desktop-only,
                    .desktop-text,
                    .desktop-pages,
                    .limit-selector,
                    .pagination-info {
                        display: none !important;
                    }

                    .pagination-controls {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: center !important;
                        gap: 0 !important;
                        flex: 0 0 auto !important;
                        min-width: 0 !important;
                    }

                    .mobile-pages {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        gap: 5px !important;
                    }

                    .mpg-num,
                    .mpg-nav {
                        flex: 0 0 auto;
                        min-width: 38px;
                        width: 38px;
                        height: 38px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        border: none;
                        background: transparent;
                        border-radius: 9999px;
                        cursor: pointer;
                        font-size: 0.95rem;
                        font-weight: 600;
                        line-height: 1;
                        color: #334155;
                        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                        -webkit-tap-highlight-color: transparent;
                    }

                    .mpg-num.is-active {
                        background: #2563eb;
                        color: #ffffff;
                        font-weight: 700;
                        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.38);
                        transform: scale(1.05);
                    }

                    .mpg-num:hover:not(.is-active),
                    .mpg-num:active:not(.is-active) {
                        background: rgba(37, 99, 235, 0.08);
                        color: #2563eb;
                    }

                    .mpg-nav {
                        color: #475569;
                        font-size: 0.92rem;
                    }

                    .mpg-nav:hover:not(:disabled),
                    .mpg-nav:active:not(:disabled) {
                        background: rgba(0, 0, 0, 0.04);
                        color: #0f172a;
                    }

                    .mpg-nav:disabled {
                        color: #cbd5e1;
                        cursor: not-allowed;
                    }

                    .mpg-gap {
                        flex: 0 0 auto;
                        min-width: 22px;
                        text-align: center;
                        color: #64748b;
                        font-size: 0.85rem;
                        font-weight: 600;
                        letter-spacing: 0.5px;
                        user-select: none;
                    }

                    :global(.dark) .pagination-container {
                        background: #0f172a !important;
                        border: 1px solid rgba(37, 99, 235, 0.4) !important;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
                    }

                    :global(.dark) .mpg-num {
                        color: #cbd5e1;
                    }

                    :global(.dark) .mpg-nav {
                        color: #94a3b8;
                    }

                    :global(.dark) .mpg-nav:disabled {
                        color: #334155;
                    }

                    :global(.dark) .mpg-num.is-active {
                        background: #2563eb;
                        color: #ffffff;
                        box-shadow: 0 0 14px rgba(37, 99, 235, 0.6);
                    }

                    :global(.dark) .mpg-num:hover:not(.is-active),
                    :global(.dark) .mpg-num:active:not(.is-active) {
                        background: rgba(59, 130, 246, 0.2);
                        color: #60a5fa;
                    }
                }

                /* Layar sangat sempit: rapatkan agar slot tetap muat */
                @media (max-width: 360px) {
                    .pagination-container {
                        padding: 4px 8px !important;
                    }

                    .mpg-num,
                    .mpg-nav {
                        min-width: 28px;
                        width: 28px;
                        height: 28px;
                        font-size: 0.8rem;
                    }

                    .mpg-gap {
                        min-width: 16px;
                    }
                }
            `}</style>
        </div>
    );
}
