'use client';
import { useState, useMemo, useEffect } from 'react';
import Pagination from '@/components/ui/Pagination';

import React from 'react';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface KeuanganTabAntreanProps {
    filteredRequests: any[];
    stBadge: (status: string) => string;
    fmtRp: (v: any) => string;
    setSelectedRequest: (r: any) => void;
    setShowDetailModal: (v: boolean) => void;
    exportRequestItemsToExcel: (items: any[], activityName?: string, requestNumber?: string) => void;
    canApproveStage: (r: any) => boolean;
    openApprovalModal: (r: any) => void;
    canManageRegisters: (r: any) => boolean;
    openRegisterModal: (r: any) => void;
}

export default function KeuanganTabAntrean({
    filteredRequests,
    stBadge,
    fmtRp,
    setSelectedRequest,
    setShowDetailModal,
    exportRequestItemsToExcel,
    canApproveStage,
    openApprovalModal,
    canManageRegisters,
    openRegisterModal,
}: KeuanganTabAntreanProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { setPage(1); }, [filteredRequests]);
    const totalPages = Math.ceil(filteredRequests.length / pageSize);
    const paginatedRequests = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRequests.slice(start, start + pageSize);
    }, [filteredRequests, page, pageSize]);
    return (
        <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 700 }}>Antrean Persetujuan</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Pemohon</th>
                        <th>Kegiatan</th>
                        <th>Nominal</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedRequests.map(r => (
                        <tr key={r.id}>
                            <td>
                                <div style={{ fontWeight: 600 }}>{r.users?.nama}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: '2px' }}><strong>{r.request_number || '-'}</strong></div>
                            </td>
                            <td>{r.activity_name}<br/><span style={{ fontSize: '0.7rem', color: 'gray' }}>{r.divisions?.name}</span></td>
                            <td>{fmtRp(r.total_amount)}</td>
                            <td><span className={`status-badge ${stBadge(r.status)}`}>{r.status}</span></td>
                            <td style={{ textAlign: 'right' }}>
                                <ActionGroup>
                                    <ActionButton action="view" title="Lihat Rincian" onClick={() => { setSelectedRequest(r); setShowDetailModal(true); }} />
                                    <ActionButton action="export" title="Export Excel Item" onClick={() => exportRequestItemsToExcel(r.budget_request_items, r.activity_name, r.request_number)} />
                                    {canApproveStage(r) && (
                                        <ActionButton action="settings" title="Verifikasi Pimpinan" onClick={() => openApprovalModal(r)} />
                                    )}
                                    {canManageRegisters(r) && (
                                        <ActionButton action="file" title="Kelola Register" onClick={() => openRegisterModal(r)} />
                                    )}
                                </ActionGroup>
                            </td>
                        </tr>
                    ))}
                    {filteredRequests.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada antrean pengajuan</td></tr>}
                </tbody>
            </table>
            <Pagination currentPage={page} totalPages={totalPages} limit={pageSize} totalItems={filteredRequests.length} onPageChange={setPage} onLimitChange={setPageSize} itemLabel="pengajuan" />
        </div>
    );
}
