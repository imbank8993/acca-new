'use client';

import React, { useState, useMemo } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { ACADEMIC_MONTHS, executeExport } from '../lib/exportUtils';
import { Journal } from '../types';
import Swal from 'sweetalert2';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    canDo: (action: string) => boolean;
    isWali?: boolean;
    journals: Journal[];
    allJournals?: Journal[];
    selectedTeacher: string | null;
    selectedSubject: string | null;
    selectedClass: string | null;
    searchTerm: string;
    isJournalRelated: (j: Journal, nip: string, name: string) => boolean;
    checkNameMatch: (value: any, target: any) => boolean;
    displayGroups: (data: Journal[]) => any[];
    allWaktu: any[];
    masterData?: any;
    selectedTahunAjaran?: string;
    allKelas?: string[];
}

export default function ExportModal({
    isOpen,
    onClose,
    user,
    canDo,
    isWali,
    journals,
    allJournals,
    selectedTeacher,
    selectedSubject,
    selectedClass,
    searchTerm,
    isJournalRelated,
    checkNameMatch,
    displayGroups,
    allWaktu,
    masterData,
    selectedTahunAjaran,
    allKelas = []
}: ExportModalProps) {
    const roles = (user?.roles || []).map((r: string) => String(r).toUpperCase());
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR') || user?.role === 'ADMIN';

    // Daftar mode yang diizinkan untuk akun pengguna
    const availableModes = useMemo(() => {
        const list: { key: 'GURU' | 'ADMIN' | 'WALI'; label: string; icon: string; desc: string }[] = [];
        if (canDo('export')) {
            list.push({ key: 'GURU', label: 'Guru', icon: 'bi-person-badge', desc: 'Jurnal personal saya' });
        }
        if (canDo('export') && (isAdmin || canDo('manage') || user?.roles?.includes('OP_JURNAL'))) {
            list.push({ key: 'ADMIN', label: 'Admin', icon: 'bi-shield-check', desc: 'Semua data jurnal' });
        }
        if (isWali) {
            list.push({ key: 'WALI', label: 'Wali Kelas', icon: 'bi-people', desc: 'Jurnal kelas binaan' });
        }
        return list;
    }, [canDo, isAdmin, isWali, user?.roles]);

    const defaultMode = availableModes[0]?.key || 'GURU';
    const [exportMode, setExportMode] = useState<'GURU' | 'ADMIN' | 'WALI'>(defaultMode);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [exporting, setExporting] = useState(false);

    // Filter daftar kelas yang relevan untuk guru atau admin
    const availableClasses = useMemo(() => {
        const pool = allJournals && allJournals.length > 0 ? allJournals : journals;
        if (exportMode === 'GURU' && user?.nip) {
            return Array.from(new Set(
                pool.filter((j: any) => isJournalRelated(j, user.nip, user.nama)).map((j: any) => j.kelas)
            )).filter(Boolean).sort() as string[];
        }
        if (exportMode === 'ADMIN') {
            if (allKelas.length > 0) return allKelas;
            return Array.from(new Set(pool.map((j: any) => j.kelas))).filter(Boolean).sort() as string[];
        }
        return [];
    }, [exportMode, user?.nip, user?.nama, allJournals, journals, isJournalRelated, allKelas]);

    if (!isOpen) return null;

    const currentTahunAjaran = selectedTahunAjaran || (
        new Date().getMonth() + 1 >= 7
            ? `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
            : `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`
    );

    const handleDoExport = async () => {
        setExporting(true);
        try {
            await executeExport(
                exportMode,
                { bulan: selectedMonths, kelas: selectedClasses },
                user,
                allJournals && allJournals.length > 0 ? allJournals : journals,
                selectedTeacher,
                selectedSubject,
                selectedClass,
                searchTerm,
                isJournalRelated,
                checkNameMatch,
                displayGroups,
                allWaktu,
                masterData,
                currentTahunAjaran
            );
            onClose();
        } catch (err: any) {
            console.error('Export gagal:', err);
            Swal.fire('Gagal Export', err?.message || 'Terjadi kesalahan saat memproses export.', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            size="md"
            onClose={onClose}
            labelledBy="modal-export-jurnal-title"
        >
            <ModalHeader
                id="modal-export-jurnal-title"
                icon="file-earmark-pdf"
                title="Export Jurnal PDF A4"
                subtitle={exportMode === 'GURU' && user?.nama ? `${user.nama}${user?.nip ? ` (${user.nip})` : ''}` : undefined}
                onClose={onClose}
            />

            <ModalBody className="em-modal-body">
                {/* Tabs Mode Export */}
                {availableModes.length > 1 && (
                    <div className="em-tabs">
                        {availableModes.map((m) => (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                    setExportMode(m.key);
                                    setSelectedClasses([]);
                                }}
                                className={`em-tab ${exportMode === m.key ? 'active' : ''}`}
                            >
                                <i className={`bi ${m.icon}`}></i>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="em-section">
                    {/* Badge Tahun Ajaran */}
                    <div className="em-info-ta">
                        <i className="bi bi-mortarboard-fill text-blue-600 dark:text-blue-400"></i>
                        <span>Tahun Ajaran: <strong>{currentTahunAjaran}</strong></span>
                    </div>

                    {/* Mode Wali Kelas Information */}
                    {exportMode === 'WALI' && (
                        <div className="em-info-box">
                            <i className="bi bi-info-circle-fill text-blue-500"></i>
                            <span>Mengekspor jurnal mengajar kelas reguler dan seluruh kelas peminatan siswa yang berada di bawah perwalian Anda.</span>
                        </div>
                    )}

                    {/* Dropdown Multi-Select Bulan */}
                    <div className="em-field">
                        <label>Pilih Bulan</label>
                        <MultiSelectDropdown
                            options={ACADEMIC_MONTHS.map(m => ({ value: m.value, label: m.label }))}
                            value={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="Semua bulan..."
                            allSelectedText="Semua Bulan Terpilih"
                            columns={2}
                            height="40px"
                        />
                        <span className="em-hint">Kosongkan untuk mengekspor seluruh bulan dalam tahun ajaran.</span>
                    </div>

                    {/* Dropdown Multi-Select Kelas (untuk mode Guru & Admin) */}
                    {exportMode !== 'WALI' && availableClasses.length > 0 && (
                        <div className="em-field">
                            <label>Pilih Kelas</label>
                            <MultiSelectDropdown
                                options={availableClasses.map(k => ({ value: k, label: k }))}
                                value={selectedClasses}
                                onChange={setSelectedClasses}
                                placeholder="Semua kelas..."
                                allSelectedText="Semua Kelas Terpilih"
                                columns={availableClasses.length > 6 ? 2 : 1}
                                height="40px"
                            />
                            <span className="em-hint">Kosongkan untuk mengekspor seluruh kelas.</span>
                        </div>
                    )}
                </div>
            </ModalBody>

            <ModalFooter>
                <Button
                    variant="cancel"
                    type="button"
                    onClick={onClose}
                    disabled={exporting}
                >
                    Batal
                </Button>
                <Button
                    variant="primary"
                    type="button"
                    onClick={handleDoExport}
                    isLoading={exporting}
                    icon="download"
                >
                    {exporting ? 'Menyiapkan PDF...' : 'Unduh PDF'}
                </Button>
            </ModalFooter>

            <style jsx>{`
                :global(.em-modal-body) {
                    padding: 1.25rem 1.5rem !important;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .em-tabs {
                    display: flex;
                    gap: 6px;
                    background: var(--n-soft, #f1f5f9);
                    padding: 5px;
                    border-radius: 12px;
                    width: 100%;
                }
                .em-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 12px;
                    border: none;
                    background: transparent;
                    border-radius: 9px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--n-muted, #64748b);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .em-tab:hover {
                    color: var(--n-ink, #0f172a);
                    background: var(--n-elevated, #e2e8f0);
                }
                .em-tab.active {
                    background: var(--n-card, #ffffff);
                    color: var(--n-primary, #0038A8);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
                }
                .em-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .em-info-ta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    color: #1e40af;
                }
                :global(.dark) .em-info-ta {
                    background: rgba(30, 58, 138, 0.25);
                    border-color: rgba(59, 130, 246, 0.4);
                    color: #93c5fd;
                }
                .em-info-box {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 10px 12px;
                    background: var(--n-soft, #f8fafc);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 10px;
                    font-size: 0.78rem;
                    line-height: 1.45;
                    color: var(--n-muted, #64748b);
                }
                .em-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .em-field label {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--n-ink, #1e293b);
                }
                .em-hint {
                    font-size: 0.72rem;
                    color: var(--n-muted, #94a3b8);
                    font-style: italic;
                    margin-top: 2px;
                }
            `}</style>
        </Modal>
    );
}
