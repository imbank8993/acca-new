'use client';

import { useState, useEffect, useRef } from 'react';
import Select, { components } from 'react-select';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { hasPermission } from '@/lib/permissions-client';
import DatePicker from '@/components/ui/DatePicker';
import { Spinner } from '@/components/ui/Spinner';

const CheckboxOption = (props: any) => {
    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>{props.label}</span>
            </div>
        </components.Option>
    );
};

export default function GenerateJurnalTab({ user }: { user?: any }) {
    // Permission Check
    const permissions = user?.permissions || []
    const isAdmin = (user?.role === 'ADMIN') || (user?.roles?.some((r: string) => r.toUpperCase() === 'ADMIN')) || false
    const isOPJurnal = (user?.roles || []).some((r: string) => r.toUpperCase() === 'OP_JURNAL') || false
    const userRoles = user?.roles || []
    const canManage = isAdmin || isOPJurnal || hasPermission(permissions, 'pengaturan_data:generate_jurnal', 'manage', isAdmin, userRoles) ||
        hasPermission(permissions, 'pengaturan_data.generate_jurnal', 'manage', isAdmin, userRoles)
    const canImport = canManage || hasPermission(permissions, 'pengaturan_data:generate_jurnal', 'import', isAdmin, userRoles) ||
        hasPermission(permissions, 'pengaturan_data.generate_jurnal', 'import', isAdmin, userRoles)

    const [settings, setSettings] = useState({
        is_auto_generate_enabled: false,
        generate_start_date: '',
        generate_end_date: '',
        skip_holidays: true
    });

    const [jamOptions, setJamOptions] = useState<number[]>([]);

    const [manualDates, setManualDates] = useState({
        startDate: '',
        endDate: '',
        jamKe: [] as number[]
    });

    const [deleteDates, setDeleteDates] = useState({
        startDate: '',
        endDate: '',
        jamKe: [] as number[]
    });

    // Which action is currently running (null = idle). Lets each button show its own busy state.
    const [loadingAction, setLoadingAction] = useState<null | 'settings' | 'generate' | 'import' | 'delete'>(null);
    const isBusy = loadingAction !== null;
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Import State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importData, setImportData] = useState<any[]>([]);
    const [importStats, setImportStats] = useState<{ total: number, valid: number } | null>(null);
    const [importProgress, setImportProgress] = useState<{ step: string; current: number; total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Track dark mode so react-select styling matches the app theme
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        loadSettings();
        loadJamOptions();
    }, []);

    useEffect(() => {
        const el = document.documentElement;
        const update = () => setIsDark(el.classList.contains('dark'));
        update();
        const obs = new MutationObserver(update);
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);

    // Clear any loaded/pending import file and its parsed data
    const resetImport = () => {
        setImportFile(null);
        setImportData([]);
        setImportStats(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/jurnal/pengaturan');
            const data = await res.json();
            if (res.ok && (data.success || data.ok)) {
                setSettings({
                    is_auto_generate_enabled: data.data.is_auto_generate_enabled || false,
                    generate_start_date: data.data.generate_start_date || '',
                    generate_end_date: data.data.generate_end_date || '',
                    skip_holidays: data.data.skip_holidays ?? true
                });
            }
        } catch (error) {
            console.error('Gagal memuat pengaturan', error);
        }
    };

    const loadJamOptions = async () => {
        try {
            const res = await fetch('/api/master/waktu?limit=10000&show_inactive=false');
            const result = await res.json();
            if (res.ok && result.data && Array.isArray(result.data)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const uniqueJams = Array.from(new Set(result.data.map((item: any) => item.jam_ke))).sort((a: any, b: any) => a - b);
                setJamOptions(uniqueJams as number[]);
            }
        } catch (error) {
            console.error('Failed to load jam options', error);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleSaveSettings = async () => {
        if (!canManage) return
        if (settings.generate_start_date && settings.generate_end_date && settings.generate_end_date < settings.generate_start_date) {
            showMessage('error', 'Tanggal "Sampai" tidak boleh sebelum tanggal "Mulai Berlaku"');
            return;
        }
        setLoadingAction('settings');
        try {
            const res = await fetch('/api/jurnal/pengaturan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...settings, created_by: user?.username || 'admin' })
            });

            const data = await res.json();
            if (res.ok && (data.success || data.ok)) {
                showMessage('success', 'Pengaturan berhasil disimpan');
            } else {
                throw new Error(data.error || data.message || 'Gagal menyimpan');
            }
        } catch (error: any) {
            console.error(error);
            showMessage('error', error?.message || 'Gagal menyimpan pengaturan');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleGenerateManual = async () => {
        if (!canManage) return
        if (!manualDates.startDate) {
            showMessage('error', 'Tanggal mulai wajib diisi');
            return;
        }
        if (manualDates.endDate && manualDates.endDate < manualDates.startDate) {
            showMessage('error', 'Tanggal "Selesai" tidak boleh sebelum tanggal "Mulai"');
            return;
        }

        setLoadingAction('generate');
        try {
            const res = await fetch('/api/jurnal/pengaturan/generate-massal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: manualDates.startDate,
                    endDate: manualDates.endDate,
                    jamKe: manualDates.jamKe.join(',')
                })
            });

            const result = await res.json();
            if (res.ok && (result.success || result.ok)) {
                showMessage('success', `Berhasil generate ${result.results?.generated ?? result.generated ?? 0} jurnal.`);
            } else {
                showMessage('error', result.error || result.message || 'Gagal generate');
            }
        } catch (error: any) {
            showMessage('error', 'Gagal generate jurnal: ' + error.message);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDeleteByDate = async () => {
        if (!canManage) return
        if (!deleteDates.startDate) {
            showMessage('error', 'Tanggal mulai wajib diisi');
            return;
        }
        if (deleteDates.endDate && deleteDates.endDate < deleteDates.startDate) {
            showMessage('error', 'Tanggal "Selesai" tidak boleh sebelum tanggal "Mulai"');
            return;
        }

        const endDate = deleteDates.endDate || deleteDates.startDate;
        const jamInfo = deleteDates.jamKe.length > 0 ? ` (Jam: ${deleteDates.jamKe.join(', ')})` : ' (Semua Jam)';

        const { isConfirmed } = await Swal.fire({
            title: 'Hapus Jurnal?',
            html: `Menghapus jurnal dari <b>${deleteDates.startDate}</b> sampai <b>${endDate}</b><br/>${jamInfo}<br/><br/>Tindakan ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
        });
        if (!isConfirmed) return;

        setLoadingAction('delete');
        try {
            const params = new URLSearchParams();
            params.append('startDate', deleteDates.startDate);
            if (endDate) params.append('endDate', endDate);
            if (deleteDates.jamKe.length > 0) params.append('jamKe', deleteDates.jamKe.join(','));

            const res = await fetch(`/api/jurnal/pengaturan/delete-by-date?${params.toString()}`, {
                method: 'DELETE',
            });

            const result = await res.json();
            if (res.ok && (result.success || result.ok)) {
                const count = result.deleted_count ?? result.count ?? result.dihapus ?? 0;
                showMessage('success', `Berhasil menghapus ${count} jurnal`);
            } else {
                showMessage('error', result.error || result.message || 'Gagal menghapus');
            }
        } catch (error: any) {
            showMessage('error', 'Gagal menghapus jurnal: ' + error.message);
        } finally {
            setLoadingAction(null);
        }
    };

    // --- Import Functions ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });

            // Always read the "DB Import" sheet first (exact DB column names)
            let ws = wb.Sheets['DB Import'];
            // Fallback to first sheet if no named sheet found
            if (!ws) ws = wb.Sheets[wb.SheetNames[0]];

            const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

            if (data.length === 0) {
                showMessage('error', 'Sheet tidak ditemukan atau kosong');
                resetImport();
                return;
            }

            // Validate required columns
            const requiredCols = ['tanggal', 'jam_ke', 'kelas', 'nama_guru'];
            const headers = Object.keys(data[0] || {});
            const missing = requiredCols.filter(c => !headers.includes(c));
            if (missing.length > 0) {
                showMessage('error', `Kolom wajib tidak ditemukan: ${missing.join(', ')}`);
                resetImport();
                return;
            }

            setImportData(data);
            setImportStats({ total: data.length, valid: data.length });
        };
        reader.readAsBinaryString(file);
    };

    const handleImportSubmit = async () => {
        if (!canImport) return
        if (importData.length === 0) {
            showMessage('error', 'Tidak ada data valid untuk diimport');
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Import Jurnal?',
            html: `Import <b>${importData.length}</b> baris data jurnal?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Import',
            cancelButtonText: 'Batal',
        });
        if (!isConfirmed) return;

        setLoadingAction('import');
        setImportProgress({ step: 'Mengirim data...', current: 0, total: importData.length });

        try {
            const res = await fetch('/api/jurnal/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: importData })
            });

            setImportProgress({ step: 'Memproses di server...', current: Math.floor(importData.length * 0.4), total: importData.length });

            const result = await res.json();

            setImportProgress({ step: 'Menyimpan hasil...', current: importData.length, total: importData.length });

            if (result.success && result.results) {
                const { success, failed, skipped } = result.results;
                const errMsg = result.results.errors?.length > 0
                    ? `\nGagal: ${result.results.errors.slice(0, 3).join('\n')}${result.results.errors.length > 3 ? '\n...' : ''}`
                    : '';
                showMessage('success', `Import Selesai. Sukses: ${success}, Gagal: ${failed}, Skip: ${skipped}${errMsg}`);
            } else {
                throw new Error(result.error || 'Import gagal');
            }
            resetImport();
        } catch (error: any) {
            showMessage('error', 'Gagal import: ' + error.message);
        } finally {
            setLoadingAction(null);
            setTimeout(() => setImportProgress(null), 1500);
        }
    };

    // Convert jam options to react-select format
    const jamSelectOptions = jamOptions.map(jam => ({
        value: jam,
        label: `Jam Ke-${jam}`
    }));

    // Theme-aware react-select styling (follows the app's dark mode)
    const t = isDark
        ? {
            bg: '#1e293b', bgFocus: '#0f172a', border: '#334155', borderHover: '#3b82f6',
            text: '#e2e8f0', menuBg: '#1e293b', optHover: 'rgba(59,130,246,0.18)',
            chipBg: 'rgba(59,130,246,0.18)', chipText: '#93c5fd', chipHover: 'rgba(59,130,246,0.32)',
            placeholder: '#94a3b8',
        }
        : {
            bg: '#f8fafc', bgFocus: '#ffffff', border: '#cbd5e1', borderHover: '#3b82f6',
            text: '#0f172a', menuBg: '#ffffff', optHover: '#eff6ff',
            chipBg: '#eff6ff', chipText: '#1e40af', chipHover: '#dbeafe',
            placeholder: '#94a3b8',
        };

    const customSelectStyles = {
        control: (base: any, state: any) => ({
            ...base,
            borderRadius: '12px',
            border: isDark ? '1.8px solid rgba(26, 115, 232, 0.75)' : '1.5px solid #e2e8f0',
            boxShadow: state.isFocused ? (isDark ? '0 0 12px rgba(26, 115, 232, 0.4)' : '0 0 0 3px rgba(59, 130, 246, 0.1)') : 'none',
            background: isDark ? '#000000' : (state.isFocused ? '#ffffff' : '#f8fafc'),
            padding: '0 4px',
            minHeight: '40px',
            height: '40px',
            fontSize: '0.85rem',
            fontWeight: '600',
            '&:hover': { borderColor: isDark ? '#3b82f6' : '#3b82f6' },
        }),
        valueContainer: (base: any) => ({
            ...base,
            padding: '2px 8px',
        }),
        input: (base: any) => ({
            ...base,
            margin: '0',
            padding: '0',
            color: isDark ? '#ffffff' : '#0f172a',
            caretColor: isDark ? '#60a5fa' : '#1a73e8',
        }),
        menu: (base: any) => ({
            ...base,
            borderRadius: '12px',
            background: isDark ? '#000000' : '#ffffff',
            border: isDark ? '1.8px solid rgba(26, 115, 232, 0.75)' : '1px solid #e2e8f0',
            boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.85)' : '0 10px 25px rgba(0,0,0,0.1)',
            zIndex: 99999,
            overflow: 'hidden'
        }),
        menuPortal: (base: any) => ({ ...base, zIndex: 99999 }),
        option: (base: any, state: any) => ({
            ...base,
            background: state.isFocused
                ? (isDark ? 'rgba(26, 115, 232, 0.2)' : 'rgba(59, 130, 246, 0.1)')
                : (isDark ? '#000000' : 'transparent'),
            color: state.isFocused
                ? (isDark ? '#60a5fa' : '#1e40af')
                : (isDark ? '#e2e8f0' : '#0f172a'),
            cursor: 'pointer',
        }),
        singleValue: (base: any) => ({ ...base, color: isDark ? '#ffffff' : '#0f172a', fontWeight: '600' }),
        placeholder: (base: any) => ({ ...base, color: isDark ? '#94a3b8' : '#94a3b8' }),
        multiValue: (base: any) => ({
            ...base,
            backgroundColor: isDark ? 'rgba(26, 115, 232, 0.22)' : '#eff6ff',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(26, 115, 232, 0.45)' : '1px solid rgba(147, 197, 253, 0.7)',
        }),
        multiValueLabel: (base: any) => ({
            ...base,
            color: isDark ? '#60a5fa' : '#1e40af',
            fontWeight: '600',
        }),
        multiValueRemove: (base: any) => ({
            ...base,
            color: isDark ? '#60a5fa' : '#1e40af',
            ':hover': {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#dbeafe',
                color: isDark ? '#f87171' : '#dc2626',
            },
        }),
        dropdownIndicator: (base: any) => ({
            ...base,
            padding: '4px',
            color: isDark ? '#60a5fa' : '#94a3b8',
            '&:hover': {
                color: isDark ? '#3b82f6' : '#1a73e8',
            }
        }),
        indicatorSeparator: () => ({ display: 'none' }),
    };


    return (
        <div className="gj">
            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="grid">
                {/* Auto Generate Settings */}
                <div className="card blue">
                    <div className="card-head">
                        <i className="bi bi-gear-wide-connected"></i>
                        <div className="card-head-text">
                            <h3>Pengaturan Otomatis</h3>
                            <p>Jadwalkan pembuatan jurnal harian</p>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="auto-generate"
                                checked={settings.is_auto_generate_enabled}
                                onChange={(e) => setSettings({ ...settings, is_auto_generate_enabled: e.target.checked })}
                            />
                            <label htmlFor="auto-generate">Aktifkan Generate Harian Otomatis</label>
                        </div>

                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="skip-holidays"
                                checked={settings.skip_holidays}
                                onChange={(e) => setSettings({ ...settings, skip_holidays: e.target.checked })}
                            />
                            <label htmlFor="skip-holidays">Lewati Hari Libur</label>
                        </div>

                        <div className="form-group">
                            <label>Mulai Berlaku</label>
                            <DatePicker
                                value={settings.generate_start_date}
                                onChange={(v) => setSettings({ ...settings, generate_start_date: v })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Sampai Tanggal</label>
                            <DatePicker
                                value={settings.generate_end_date}
                                onChange={(v) => setSettings({ ...settings, generate_end_date: v })}
                            />
                        </div>

                        {canManage && (
                            <button onClick={handleSaveSettings} disabled={isBusy} className="btn-primary">
                                {loadingAction === 'settings' ? <Spinner variant="trace" /> : 'Simpan Pengaturan'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Manual Generate */}
                <div className="card green">
                    <div className="card-head">
                        <i className="bi bi-magic"></i>
                        <div className="card-head-text">
                            <h3>Generate Manual</h3>
                            <p>Buat jurnal untuk rentang tanggal</p>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Mulai <span className="req">*</span></label>
                            <DatePicker
                                value={manualDates.startDate}
                                onChange={(v) => setManualDates({ ...manualDates, startDate: v })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Selesai</label>
                            <DatePicker
                                value={manualDates.endDate}
                                onChange={(v) => setManualDates({ ...manualDates, endDate: v })}
                                placeholder="Opsional (Default: 1 hari)"
                            />
                        </div>

                        <div className="form-group">
                            <label>Pilih Jam (Opsional)</label>
                            <Select
                                isMulti
                                options={jamSelectOptions}
                                value={jamSelectOptions.filter(opt => manualDates.jamKe.includes(opt.value))}
                                onChange={(selected) => setManualDates({ ...manualDates, jamKe: selected.map(s => s.value) })}
                                placeholder="Pilih jam pelajaran..."
                                styles={customSelectStyles}
                                components={{ Option: CheckboxOption }}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                menuPlacement="auto"
                                maxMenuHeight={180}
                                className="select-jam"
                            />
                        </div>

                        {canManage && (
                            <button onClick={handleGenerateManual} disabled={isBusy} className="btn-success">
                                {loadingAction === 'generate' ? <Spinner variant="trace" /> : 'Generate Sekarang'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Import Jurnal */}
                <div className="card purple">
                    <div className="card-head">
                        <i className="bi bi-file-earmark-spreadsheet"></i>
                        <div className="card-head-text">
                            <h3>Import Excel</h3>
                            <p>Impor ulang file export jurnal</p>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="alert-info">
                            <i className="bi bi-info-circle"></i>
                            File export jurnal (1 sheet DB Import) — siap di-import ulang tanpa konversi
                        </div>

                        <div className="form-group">
                            <label>File Excel (.xlsx)</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="file-input"
                            />
                        </div>

                        {importStats && (
                            <div className="stats-box">
                                <p>Total Baris: <strong>{importStats.total}</strong></p>
                                <p>Data Valid: <strong className="text-green-600">{importStats.valid}</strong></p>
                            </div>
                        )}

                        {importProgress && (
                            <div className="import-progress">
                                <div className="import-progress-label">
                                    <span>{importProgress.step}</span>
                                    <span>{importProgress.current} / {importProgress.total}</span>
                                </div>
                                <div className="import-progress-bar">
                                    <div
                                        className="import-progress-fill"
                                        style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {canImport && (
                            <button
                                onClick={handleImportSubmit}
                                disabled={isBusy || !importData.length}
                                className="btn-primary"
                            >
                                {loadingAction === 'import' ? <Spinner variant="trace" /> : 'Mulai Import'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Delete Jurnal */}
                <div className="card red">
                    <div className="card-head">
                        <i className="bi bi-trash"></i>
                        <div className="card-head-text">
                            <h3>Hapus Massal</h3>
                            <p>Hapus jurnal berdasarkan tanggal</p>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="alert-danger">
                            <i className="bi bi-exclamation-triangle"></i>
                            Perhatian: Data yang dihapus tidak dapat dikembalikan.
                        </div>

                        <div className="form-group">
                            <label>Mulai <span className="req">*</span></label>
                            <DatePicker
                                value={deleteDates.startDate}
                                onChange={(v) => setDeleteDates({ ...deleteDates, startDate: v })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Selesai</label>
                            <DatePicker
                                value={deleteDates.endDate}
                                onChange={(v) => setDeleteDates({ ...deleteDates, endDate: v })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Hapus Jam Tertentu (Opsional)</label>
                            <Select
                                isMulti
                                options={jamSelectOptions}
                                value={jamSelectOptions.filter(opt => deleteDates.jamKe.includes(opt.value))}
                                onChange={(selected) => setDeleteDates({ ...deleteDates, jamKe: selected.map(s => s.value) })}
                                placeholder="Pilih jam pelajaran..."
                                styles={customSelectStyles}
                                components={{ Option: CheckboxOption }}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                menuPlacement="auto"
                                maxMenuHeight={180}
                                className="select-jam"
                            />
                        </div>

                        {canManage && (
                            <button onClick={handleDeleteByDate} disabled={isBusy} className="btn-danger">
                                {loadingAction === 'delete' ? <Spinner variant="trace" /> : 'Hapus Permanen'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .gj { animation: fadeIn 0.4s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .grid {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    width: 100%;
                }

                .card {
                    background: var(--n-card);
                    border-radius: 16px;
                    border: 1px solid var(--n-border);
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); }

                .card-head {
                    padding: 12px 18px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-bottom: 1px solid var(--n-border);
                }
                .card-head i { font-size: 1.15rem; flex-shrink: 0; }
                .card-head-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                .card-head h3 { margin: 0; font-size: 0.92rem; font-weight: 750; color: var(--n-text); }
                .card-head-sub, .card-head-text p { margin: 0; font-size: 0.78rem; font-weight: 500; opacity: 0.8; }

                .card.blue .card-head { background: #eff6ff; color: #1e40af; border-color: #dbeafe; }
                .card.green .card-head { background: #f0fdf4; color: #15803d; border-color: #dcfce7; }
                .card.red .card-head { background: #fef2f2; color: #b91c1c; border-color: #fee2e2; }
                .card.purple .card-head { background: #f5f3ff; color: #4c1d95; border-color: #ede9fe; }

                .card-body { 
                    padding: 16px 18px; 
                    display: flex; 
                    flex-wrap: wrap; 
                    align-items: flex-end; 
                    gap: 14px 16px; 
                }

                .form-group { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 6px; 
                    flex: 1 1 180px; 
                    min-width: 160px; 
                }
                .form-group label { 
                    font-size: 0.82rem; 
                    font-weight: 650; 
                    color: var(--n-muted); 
                    margin: 0; 
                }
                .req { color: #ef4444; }

                input[type="date"] {
                    padding: 0 12px;
                    height: 40px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 12px;
                    background: var(--n-soft);
                    font-size: 0.85rem;
                    font-weight: 500;
                    outline: none;
                    transition: all 0.2s;
                    width: 100%;
                    box-sizing: border-box;
                }
                input[type="date"]:focus {
                    border-color: #3b82f6;
                    background: var(--n-card);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .checkbox-group { 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    cursor: pointer; 
                    height: 40px; 
                    align-self: flex-end; 
                    flex: 0 0 auto; 
                }
                .checkbox-group input { width: 17px; height: 17px; cursor: pointer; border-radius: 4px; }
                .checkbox-group label { font-size: 0.85rem; font-weight: 600; color: var(--n-text); cursor: pointer; margin: 0; white-space: nowrap; }

                .btn-primary, .btn-success, .btn-danger {
                    padding: 0 18px;
                    height: 40px;
                    min-height: 40px;
                    width: 175px;
                    min-width: 175px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: white;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 0;
                    align-self: flex-end;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                    flex: 0 0 auto;
                }
                .btn-primary { background: linear-gradient(135deg, #3083FF, #00287a); }
                .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(0, 56, 168, 0.3); transform: translateY(-1px); }
                
                .btn-success { background: linear-gradient(135deg, #10b981, #059669); }
                .btn-success:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); transform: translateY(-1px); }

                .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
                .btn-danger:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3); transform: translateY(-1px); }

                button:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }

                .hint { font-size: 0.75rem; color: var(--n-muted); margin-top: 2px; font-style: italic; }

                .alert-danger {
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    color: #b91c1c;
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 0.82rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    flex: 1 1 100%;
                }

                .alert-info {
                     background: #eff6ff;
                     border: 1px solid #dbeafe;
                     color: #1e40af;
                     padding: 10px 14px;
                     border-radius: 12px;
                     font-size: 0.82rem;
                     font-weight: 500;
                     display: flex;
                     align-items: center;
                     gap: 8px;
                     width: 100%;
                     flex: 1 1 100%;
                }

                .stats-box {
                    background: var(--n-soft);
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px dashed var(--n-border);
                    color: var(--n-text);
                    font-size: 0.82rem;
                    width: 100%;
                    flex: 1 1 100%;
                }

                .import-progress {
                    background: var(--n-soft);
                    border: 1px solid #e0e7ff;
                    border-radius: 12px;
                    padding: 10px 14px;
                    width: 100%;
                    flex: 1 1 100%;
                }
                .import-progress-label {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #002a7a;
                    margin-bottom: 6px;
                }
                .import-progress-bar {
                    height: 6px;
                    background: #e0e7ff;
                    border-radius: 3px;
                    overflow: hidden;
                }
                .import-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #3083FF, #3083FF);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .file-input {
                    padding: 6px 12px;
                    height: 40px;
                    border: 1.5px solid var(--n-border);
                    border-radius: 12px;
                    background: var(--n-soft);
                    color: var(--n-text);
                    font-size: 0.85rem;
                    width: 100%;
                    box-sizing: border-box;
                }

                .message {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 18px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 0.85rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    z-index: 2000;
                    animation: slideUp 0.3s ease;
                }
                .message.success { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
                .message.error { background: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6; }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                @media (max-width: 640px) {
                    .card-body { padding: 12px; gap: 10px; }
                    .form-group { flex: 1 1 100%; }
                    .btn-primary, .btn-success, .btn-danger { width: 100%; min-width: unset; }
                }

                /* ===== DARK MODE FULL ===== */
                :global(.dark) .gj { background: transparent !important; }
                :global(.dark) .card {
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                }
                :global(.dark) .card-head { border-bottom: 1px solid rgba(37, 99, 235, 0.4) !important; }
                :global(.dark) .card-head h3 { color: #ffffff !important; }
                :global(.dark) .card-head p, :global(.dark) .card-head-sub { color: rgba(255, 255, 255, 0.7) !important; }

                :global(.dark) .card.blue .card-head {
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.18) 0%, rgba(0, 40, 122, 0.28) 100%) !important;
                    color: #60a5fa !important;
                    border-bottom-color: rgba(26, 115, 232, 0.45) !important;
                }
                :global(.dark) .card.green .card-head {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.28) 100%) !important;
                    color: #34d399 !important;
                    border-bottom-color: rgba(16, 185, 129, 0.45) !important;
                }
                :global(.dark) .card.purple .card-head {
                    background: linear-gradient(135deg, rgba(129, 140, 248, 0.18) 0%, rgba(79, 70, 229, 0.28) 100%) !important;
                    color: #818cf8 !important;
                    border-bottom-color: rgba(129, 140, 248, 0.45) !important;
                }
                :global(.dark) .card.red .card-head {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.28) 100%) !important;
                    color: #f87171 !important;
                    border-bottom-color: rgba(239, 68, 68, 0.45) !important;
                }

                :global(.dark) .form-group label { color: #94a3b8 !important; font-weight: 650 !important; }
                :global(.dark) input[type="date"] {
                    height: 40px !important;
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 10px rgba(26, 115, 232, 0.15) !important;
                }
                :global(.dark) .checkbox-group label { color: #ffffff !important; font-weight: 600 !important; }
                :global(.dark) .checkbox-group input { accent-color: #1a73e8 !important; }
                :global(.dark) .file-input {
                    height: 40px !important;
                    background: #000000 !important;
                    border: 1.8px solid rgba(26, 115, 232, 0.75) !important;
                    border-radius: 12px !important;
                    color: #ffffff !important;
                }
                :global(.dark) .hint { color: #94a3b8 !important; }
                :global(.dark) .stats-box {
                    background: rgba(26, 115, 232, 0.08) !important;
                    border: 1px dashed rgba(26, 115, 232, 0.4) !important;
                    color: #e2e8f0 !important;
                    border-radius: 12px !important;
                }
                :global(.dark) .alert-info {
                    background: rgba(26, 115, 232, 0.12) !important;
                    border: 1.5px solid rgba(26, 115, 232, 0.4) !important;
                    color: #60a5fa !important;
                    border-radius: 12px !important;
                }
                :global(.dark) .alert-danger {
                    background: rgba(239, 68, 68, 0.12) !important;
                    border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
                    color: #f87171 !important;
                    border-radius: 12px !important;
                }

                :global(.dark) .btn-primary {
                    background: #1a73e8 !important;
                    color: #ffffff !important;
                    border: 1.8px solid #3b82f6 !important;
                    box-shadow: 0 0 14px rgba(26, 115, 232, 0.5) !important;
                }
                :global(.dark) .btn-primary:hover:not(:disabled) {
                    background: #2563eb !important;
                    box-shadow: 0 0 18px rgba(26, 115, 232, 0.7) !important;
                }
                :global(.dark) .btn-success {
                    background: #059669 !important;
                    color: #ffffff !important;
                    border: 1.8px solid #10b981 !important;
                    box-shadow: 0 0 14px rgba(16, 185, 129, 0.4) !important;
                }
                :global(.dark) .btn-success:hover:not(:disabled) {
                    background: #10b981 !important;
                    box-shadow: 0 0 18px rgba(16, 185, 129, 0.6) !important;
                }
                :global(.dark) .btn-danger {
                    background: #dc2626 !important;
                    color: #ffffff !important;
                    border: 1.8px solid #f87171 !important;
                    box-shadow: 0 0 14px rgba(239, 68, 68, 0.4) !important;
                }
                :global(.dark) .btn-danger:hover:not(:disabled) {
                    background: #ef4444 !important;
                    box-shadow: 0 0 18px rgba(239, 68, 68, 0.6) !important;
                }
                :global(.dark) .import-progress { background: rgba(26, 115, 232, 0.1) !important; border-color: rgba(26, 115, 232, 0.3) !important; border-radius: 12px !important; }
                :global(.dark) .import-progress-label { color: #60a5fa !important; }
                :global(.dark) .import-progress-bar { background: rgba(26, 115, 232, 0.2) !important; }
                /* ===== END DARK MODE FULL ===== */
            `}</style>
        </div>
    );
}

