'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import ActionButton, { ActionGroup } from '@/components/ui/ActionButtons';

interface KeuanganTabMonitoringProps {
    filteredRequests: any[];
    stBadge: (status: string) => string;
    openFile: (url: string, title?: string) => void;
    setSelectedRequest: (r: any) => void;
    setShowDetailModal: (v: boolean) => void;
    exportRequestItemsToExcel: (items: any[], activityName?: string, requestNumber?: string) => void;
    openLaporanModal: (r: any) => void;
}

export default function KeuanganTabMonitoring({
    filteredRequests,
    stBadge,
    openFile,
    setSelectedRequest,
    setShowDetailModal,
    exportRequestItemsToExcel,
    openLaporanModal,
}: KeuanganTabMonitoringProps) {
    return (
        <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 700 }}>Arsip & Laporan</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Pemohon</th>
                        <th>Kegiatan</th>
                        <th>Status Laporan</th>
                        <th>Laporan & Nota</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRequests.map(r => (
                        <tr key={r.id}>
                            <td>
                                <div style={{ fontWeight: 600 }}>{r.users?.nama}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--n-muted)', marginTop: '2px' }}><strong>{r.request_number || '-'}</strong></div>
                            </td>
                            <td>{r.activity_name}<br/><span style={{ fontSize: '0.7rem', color: 'gray' }}>{r.divisions?.name}</span></td>
                            <td>
                                <span className={`status-badge ${stBadge(r.status)}`} style={{ display: 'block', marginBottom: '4px' }}>Utama: {r.status}</span>
                                <span className={`status-badge ${stBadge(r.receipt_status || '')}`} style={{ display: 'block' }}>Nota: {r.receipt_status || 'Belum Ada'}</span>
                            </td>
                            <td>
                                {r.report_file_url && (
                                    <Button type="button" variant="secondary" size="sm" onClick={() => openFile(r.report_file_url, `Laporan ${r.request_number || ''}`)} leftIcon={<i className="bi bi-file-earmark-pdf" />}>
                                        Lihat Laporan
                                    </Button>
                                )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <ActionGroup>
                                    <ActionButton action="view" title="Lihat Rincian" onClick={() => { setSelectedRequest(r); setShowDetailModal(true); }} />
                                    <ActionButton action="export" title="Export Excel Item" onClick={() => exportRequestItemsToExcel(r.budget_request_items, r.activity_name, r.request_number)} />
                                    <ActionButton action="surat" title="Laporan & Nota" onClick={() => openLaporanModal(r)} />
                                </ActionGroup>
                            </td>
                        </tr>
                    ))}
                    {filteredRequests.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>Belum ada data arsip</td></tr>}
                </tbody>
            </table>
        </div>
    );
}
