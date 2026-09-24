'use client';

import React from 'react';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface KeuanganTabPencairanProps {
    filteredRequests: any[];
    stBadge: (status: string) => string;
    fmtRp: (v: any) => string;
    setSelectedRequest: (r: any) => void;
    setShowDetailModal: (v: boolean) => void;
    exportRequestItemsToExcel: (items: any[], activityName?: string, requestNumber?: string) => void;
    myOfficerRoles: string[];
    handleDisburse: (reqId: string, totalAmount: number, currentDisbursed: number) => void;
    handlePending: (reqId: string) => void;
    openApprovalModal: (req: any, isBendaharaReject?: boolean) => void;
}

export default function KeuanganTabPencairan({
    filteredRequests,
    stBadge,
    fmtRp,
    setSelectedRequest,
    setShowDetailModal,
    exportRequestItemsToExcel,
    myOfficerRoles,
    handleDisburse,
    handlePending,
    openApprovalModal,
}: KeuanganTabPencairanProps) {
    const pencairanRequests = filteredRequests.filter(r => r.status === 'Antrean Pencairan' || r.status === 'Dicairkan Sebagian' || r.status === 'Pending Pencairan');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700 }}>Daftar Pencairan Dana</h3>
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
                    {pencairanRequests.map(r => (
                        <tr key={r.id}>
                            <td>
                                <div style={{ fontWeight: 600 }}>{r.users?.nama}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: '2px' }}><strong>{r.request_number || '-'}</strong></div>
                            </td>
                            <td>{r.activity_name}</td>
                            <td>{fmtRp(r.total_amount)}</td>
                            <td>
                                <span className={`status-badge ${stBadge(r.status)}`}>{r.status}</span>
                                {parseFloat(r.total_disbursed || 0) > 0 && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#047857', fontWeight: 600 }}>Tercairkan: {fmtRp(r.total_disbursed)}</div>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <ActionGroup>
                                    <ActionButton action="view" title="Lihat Rincian" onClick={() => { setSelectedRequest(r); setShowDetailModal(true); }} />
                                    <ActionButton action="export" title="Export Excel Item" onClick={() => exportRequestItemsToExcel(r.budget_request_items, r.activity_name, r.request_number)} />
                                    {myOfficerRoles.includes('BENDAHARA') && (
                                        <ActionButton action="toggle" title="Cairkan Dana" onClick={() => handleDisburse(r.id, parseFloat(r.total_amount), parseFloat(r.total_disbursed || 0))} />
                                    )}
                                    {myOfficerRoles.includes('BENDAHARA') && r.status !== 'Pending Pencairan' && (
                                        <ActionButton action="settings" title="Tunda Pencairan" onClick={() => handlePending(r.id)} />
                                    )}
                                    {myOfficerRoles.includes('BENDAHARA') && (
                                        <ActionButton action="delete" title="Kembalikan ke PJ (Revisi)" onClick={() => openApprovalModal(r, true)} />
                                    )}
                                </ActionGroup>
                            </td>
                        </tr>
                    ))}
                    {pencairanRequests.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada antrean pencairan</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
