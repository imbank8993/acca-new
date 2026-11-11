'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import './inventaris.css';

type Item = { id: string; code: string; name: string; category: string; description: string | null; location: string | null; condition: string; photo_url: string | null; quantity: number; available_now: number; active: boolean };
type Loan = { id: string; item_id: string; item: Pick<Item, 'code' | 'name' | 'photo_url'>; borrower_name: string; borrower_id: string; quantity: number; purpose: string; start_at: string; end_at: string; status: string; consent_at: string; consent_text: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; handed_over_at: string | null; returned_at: string | null; return_condition: string | null; created_at: string };
type ItemForm = Pick<Item, 'code' | 'name' | 'category' | 'description' | 'location' | 'condition' | 'photo_url' | 'quantity' | 'active'>;
const emptyItem: ItemForm = { code: '', name: '', category: '', description: '', location: '', condition: 'Baik', photo_url: null, quantity: 1, active: true };
const date = (value: string | null) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const api = async (path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(`/api/inventory/${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || 'Permintaan gagal');
  return json.data;
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal';

export default function InventoryView({ user }: { user: { roles?: string[]; role?: string } }) {
  const isManager = [...(user?.roles || []), user?.role].some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_INVENTARIS', 'KTU', 'WKM_SARPRAS'].includes(String(r).toUpperCase()));
  const [items, setItems] = useState<Item[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'barang' | 'pinjaman'>('barang');
  const [search, setSearch] = useState('');
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState<'item' | 'loan' | 'proof' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanForm, setLoanForm] = useState({ quantity: 1, purpose: '', start_at: localInput(new Date(Date.now() + 3600000)), end_at: localInput(new Date(Date.now() + 86400000)), consent: false });
  const [photo, setPhoto] = useState<File | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [itemRows, loanRows] = await Promise.all([api('items'), api('loans')]);
      setItems(itemRows); setLoans(loanRows); setError('');
    } catch (e: unknown) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = useMemo(() => items.filter(item => `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const activeLoans = loans.filter(loan => ['Disetujui', 'Dipinjam'].includes(loan.status)).length;
  const pendingLoans = loans.filter(loan => loan.status === 'Menunggu').length;
  const available = (item: Item) => item.available_now;
  const close = () => { if (!busy) { setModal(null); setPhoto(null); setSelectedItem(null); setSelectedLoan(null); } };
  const openItem = (item?: Item) => { setEditing(item?.id || null); setItemForm(item ? { code: item.code, name: item.name, category: item.category, description: item.description, location: item.location, condition: item.condition, photo_url: item.photo_url, quantity: item.quantity, active: item.active } : emptyItem); setPhoto(null); setModal('item'); };
  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!photo && !itemForm.photo_url) throw new Error('Foto barang wajib diunggah');
      let photo_url = itemForm.photo_url;
      if (photo) {
        const form = new FormData(); form.append('file', photo); form.append('folder', 'inventaris');
        const response = await fetch('/api/upload', { method: 'POST', body: form });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || 'Gagal mengunggah foto');
        photo_url = json.publicUrl || json.url || json.file_url;
      }
      await api(editing ? `items/${editing}` : 'items', editing ? 'PATCH' : 'POST', { ...itemForm, photo_url });
      setNotice(editing ? 'Barang diperbarui.' : 'Barang ditambahkan.'); setModal(null); setPhoto(null); await refresh();
    } catch (e: unknown) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const requestLoan = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedItem) return;
    setBusy(true); setError('');
    try {
      await api('loans', 'POST', { item_id: selectedItem.id, quantity: loanForm.quantity, purpose: loanForm.purpose, start_at: new Date(loanForm.start_at).toISOString(), end_at: new Date(loanForm.end_at).toISOString(), consent: loanForm.consent });
      setNotice('Pengajuan peminjaman tercatat. Menunggu persetujuan petugas.'); setModal(null); setTab('pinjaman'); await refresh();
    } catch (e: unknown) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const transition = async (loan: Loan, status: string) => {
    const review_note = status === 'Ditolak' ? window.prompt('Alasan penolakan:') : null;
    if (status === 'Ditolak' && !review_note) return;
    const return_condition = status === 'Dikembalikan' ? window.prompt('Kondisi barang saat kembali:') : null;
    if (status === 'Dikembalikan' && !return_condition) return;
    setBusy(true); setError('');
    try { await api(`loans/${loan.id}`, 'PATCH', { status, review_note, return_condition }); setNotice(`Status peminjaman: ${status}.`); await refresh(); }
    catch (e: unknown) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <div className="inv-page">
    <div className="inv-heading"><div><span className="inv-eyebrow">ACCA • PENGELOLAAN SARANA</span><h1>Inventaris</h1><p>Kelola barang, ajukan peminjaman, dan simpan bukti persetujuan dalam satu tempat.</p></div>{isManager && <button className="inv-btn primary" onClick={() => openItem()}><i className="bi bi-plus-lg" /> Tambah barang</button>}</div>
    <div className="inv-stats"><div><span>Total barang</span><strong>{items.length}</strong><small>Jenis inventaris tercatat</small></div><div><span>Sedang dipinjam</span><strong>{activeLoans}</strong><small>Pengajuan aktif</small></div><div><span>Menunggu persetujuan</span><strong>{pendingLoans}</strong><small>Perlu tindakan petugas</small></div></div>
    {notice && <div className="inv-alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup">×</button></div>}
    {error && <div className="inv-alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup">×</button></div>}
    <div className="inv-panel"><div className="inv-toolbar"><div className="inv-tabs"><button className={tab === 'barang' ? 'active' : ''} onClick={() => setTab('barang')}>Daftar barang</button><button className={tab === 'pinjaman' ? 'active' : ''} onClick={() => setTab('pinjaman')}>Peminjaman {pendingLoans > 0 && <b>{pendingLoans}</b>}</button></div>{tab === 'barang' && <input aria-label="Cari barang" placeholder="Cari nama, kode, kategori..." value={search} onChange={e => setSearch(e.target.value)} />}</div>
      {loading ? <div className="inv-empty">Memuat inventaris...</div> : tab === 'barang' ? <div className="inv-grid">{filtered.map(item => <article className="inv-card" key={item.id}><div className="inv-photo">{item.photo_url ? <Image src={item.photo_url} alt={item.name} width={500} height={300} unoptimized /> : <i className="bi bi-box-seam" />}</div><div className="inv-card-body"><div className="inv-card-top"><span>{item.category}</span><span className={item.active && available(item) > 0 ? 'inv-badge available' : 'inv-badge'}>{!item.active ? 'Nonaktif' : available(item) > 0 ? `${available(item)} tersedia` : 'Tidak tersedia'}</span></div><h3>{item.name}</h3><p className="inv-code">{item.code}</p><p>{item.description || 'Belum ada deskripsi.'}</p><div className="inv-meta"><span><i className="bi bi-geo-alt" /> {item.location || 'Lokasi belum diisi'}</span><span><i className="bi bi-heart-pulse" /> {item.condition}</span><span><i className="bi bi-layers" /> Total {item.quantity}</span></div></div><div className="inv-card-actions"><button onClick={() => { setSelectedItem(item); setLoanForm({ quantity: 1, purpose: '', start_at: localInput(new Date(Date.now() + 3600000)), end_at: localInput(new Date(Date.now() + 86400000)), consent: false }); setModal('loan'); }} disabled={!item.active}>Ajukan pinjam</button>{isManager && <button className="secondary" onClick={() => openItem(item)}>Edit</button>}</div></article>)}{!filtered.length && <div className="inv-empty">Belum ada barang yang cocok.</div>}</div> : <div className="inv-loans">{loans.map(loan => <article className="inv-loan" key={loan.id}><div className="inv-loan-main"><div><span className={`inv-badge ${loan.status.toLowerCase()}`}>{loan.status}</span><h3>{loan.item.name}</h3><p>{loan.item.code} · {loan.quantity} unit · {loan.borrower_name}</p></div><div className="inv-period"><span>Mulai: {date(loan.start_at)}</span><span>Kembali: {date(loan.end_at)}</span></div></div><p className="inv-purpose">{loan.purpose}</p><div className="inv-loan-actions"><button className="secondary" onClick={() => { setSelectedLoan(loan); setModal('proof'); }}>Lihat bukti</button>{loan.status === 'Menunggu' && isManager && <><button onClick={() => transition(loan, 'Disetujui')} disabled={busy}>Setujui</button><button className="danger" onClick={() => transition(loan, 'Ditolak')} disabled={busy}>Tolak</button></>}{loan.status === 'Menunggu' && !isManager && <button className="secondary" onClick={() => transition(loan, 'Dibatalkan')} disabled={busy}>Batalkan</button>}{loan.status === 'Disetujui' && isManager && <button onClick={() => transition(loan, 'Dipinjam')} disabled={busy}>Serahkan barang</button>}{loan.status === 'Dipinjam' && isManager && <button onClick={() => transition(loan, 'Dikembalikan')} disabled={busy}>Catat pengembalian</button>}</div></article>)}{!loans.length && <div className="inv-empty">Belum ada pengajuan peminjaman.</div>}</div>}</div>
    {modal && <div className="inv-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="inv-dialog" role="dialog" aria-modal="true" aria-label={modal === 'item' ? 'Form barang' : modal === 'loan' ? 'Form peminjaman' : 'Bukti peminjaman'}><div className="inv-dialog-head"><div><span className="inv-eyebrow">INVENTARIS ACCA</span><h2>{modal === 'item' ? editing ? 'Edit barang' : 'Tambah barang' : modal === 'loan' ? 'Ajukan peminjaman' : 'Bukti peminjaman'}</h2></div><button onClick={close} aria-label="Tutup">×</button></div>{modal === 'item' && <form onSubmit={saveItem} className="inv-form"><div className="inv-form-grid"><label>Kode barang *<input required maxLength={60} value={itemForm.code} onChange={e => setItemForm({ ...itemForm, code: e.target.value })} /></label><label>Nama barang *<input required maxLength={255} value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} /></label><label>Kategori *<input required maxLength={80} value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} placeholder="Contoh: Elektronik" /></label><label>Jumlah unit *<input required type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} /></label><label>Lokasi penyimpanan<input maxLength={120} value={itemForm.location || ''} onChange={e => setItemForm({ ...itemForm, location: e.target.value })} /></label><label>Kondisi<select value={itemForm.condition} onChange={e => setItemForm({ ...itemForm, condition: e.target.value })}><option>Baik</option><option>Perlu perbaikan</option><option>Rusak</option></select></label><label className="wide">Deskripsi<textarea rows={3} maxLength={1000} value={itemForm.description || ''} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} /></label><label className="wide">Foto barang (JPG, PNG, WebP; maks. 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] || null)} />{itemForm.photo_url && !photo && <small>Foto saat ini tersimpan.</small>}</label></div><label className="inv-check"><input type="checkbox" checked={itemForm.active} onChange={e => setItemForm({ ...itemForm, active: e.target.checked })} /> Barang aktif dan dapat dipinjam</label><div className="inv-form-actions"><button type="button" className="secondary" onClick={close}>Batal</button><button disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan barang'}</button></div></form>}{modal === 'loan' && selectedItem && <form onSubmit={requestLoan} className="inv-form"><div className="inv-selected"><i className="bi bi-box-seam" /><div><strong>{selectedItem.name}</strong><small>{selectedItem.code} · {selectedItem.quantity} unit total</small></div></div><div className="inv-form-grid"><label>Jumlah pinjam *<input required type="number" min="1" max={selectedItem.quantity} value={loanForm.quantity} onChange={e => setLoanForm({ ...loanForm, quantity: Number(e.target.value) })} /></label><label>Mulai *<input required type="datetime-local" value={loanForm.start_at} onChange={e => setLoanForm({ ...loanForm, start_at: e.target.value })} /></label><label>Sampai *<input required type="datetime-local" value={loanForm.end_at} onChange={e => setLoanForm({ ...loanForm, end_at: e.target.value })} /></label><label className="wide">Keperluan *<textarea required rows={3} maxLength={1000} value={loanForm.purpose} onChange={e => setLoanForm({ ...loanForm, purpose: e.target.value })} /></label></div><label className="inv-check"><input type="checkbox" required checked={loanForm.consent} onChange={e => setLoanForm({ ...loanForm, consent: e.target.checked })} /> Saya menyetujui peminjaman ini, bertanggung jawab menjaga kondisi barang, dan mengembalikannya sesuai waktu yang disetujui. Persetujuan akun saya akan dicatat sebagai bukti.</label><div className="inv-form-actions"><button type="button" className="secondary" onClick={close}>Batal</button><button disabled={busy}>{busy ? 'Mengajukan...' : 'Kirim pengajuan'}</button></div></form>}{modal === 'proof' && selectedLoan && <div className="inv-proof"><div className="inv-proof-title"><i className="bi bi-file-earmark-check" /><div><strong>Bukti pengajuan peminjaman</strong><small>Nomor: {selectedLoan.id}</small></div></div><dl><div><dt>Barang</dt><dd>{selectedLoan.item.name} ({selectedLoan.item.code})</dd></div><div><dt>Peminjam</dt><dd>{selectedLoan.borrower_name}</dd></div><div><dt>Jumlah</dt><dd>{selectedLoan.quantity} unit</dd></div><div><dt>Keperluan</dt><dd>{selectedLoan.purpose}</dd></div><div><dt>Durasi</dt><dd>{date(selectedLoan.start_at)} – {date(selectedLoan.end_at)}</dd></div><div><dt>Status</dt><dd>{selectedLoan.status}</dd></div><div><dt>Persetujuan peminjam</dt><dd>{selectedLoan.consent_text}<br /><small>Disetujui melalui akun pada {date(selectedLoan.consent_at)}</small></dd></div><div><dt>Keputusan petugas</dt><dd>{selectedLoan.reviewed_by ? `${selectedLoan.reviewed_by} · ${date(selectedLoan.reviewed_at)}` : 'Belum diputuskan'}{selectedLoan.review_note && <><br />{selectedLoan.review_note}</>}</dd></div>{selectedLoan.handed_over_at && <div><dt>Diserahkan</dt><dd>{date(selectedLoan.handed_over_at)}</dd></div>}{selectedLoan.returned_at && <div><dt>Dikembalikan</dt><dd>{date(selectedLoan.returned_at)} · {selectedLoan.return_condition}</dd></div>}</dl><div className="inv-form-actions"><button className="secondary" onClick={close}>Tutup</button><button onClick={() => window.print()}><i className="bi bi-printer" /> Cetak bukti</button></div></div>}</div></div>}
  </div>;
}
