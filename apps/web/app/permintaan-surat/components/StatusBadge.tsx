'use client';

interface StatusBadgeProps {
  status: string;
}

interface JenisBadgeProps {
  jenis: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase();
  
  if (norm === 'pending' || norm === 'menunggu') {
    return (
      <span className="ps-badge ps-badge--pending">
        <i className="bi bi-clock-fill" />
        Menunggu
      </span>
    );
  }

  if (norm === 'disetujui') {
    return (
      <span className="ps-badge ps-badge--disetujui">
        <i className="bi bi-check-circle-fill" />
        Disetujui
      </span>
    );
  }

  if (norm === 'ditolak') {
    return (
      <span className="ps-badge ps-badge--ditolak">
        <i className="bi bi-x-circle-fill" />
        Ditolak
      </span>
    );
  }

  if (norm === 'diproses') {
    return (
      <span className="ps-badge ps-badge--diproses">
        <i className="bi bi-arrow-repeat" />
        Diproses Operator
      </span>
    );
  }

  if (norm === 'draft') {
    return (
      <span className="ps-badge ps-badge--draft">
        <i className="bi bi-file-earmark" />
        Draft
      </span>
    );
  }

  return (
    <span className="ps-badge ps-badge--pending">
      <i className="bi bi-info-circle-fill" />
      {status || 'Menunggu'}
    </span>
  );
}

export function JenisBadge({ jenis }: JenisBadgeProps) {
  const raw = (jenis || '').trim();
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');

  const map: Record<string, { icon: string; label: string; cls: string }> = {
    surat_keterangan:  { icon: 'bi-file-earmark-check', label: 'Surat Keterangan',  cls: 'keterangan' },
    surat_tugas:       { icon: 'bi-briefcase',           label: 'Surat Tugas',       cls: 'tugas' },
    nota_dinas:        { icon: 'bi-file-earmark-text',   label: 'Nota Dinas',        cls: 'nota' },
    surat_rekomendasi: { icon: 'bi-award',               label: 'Surat Rekomendasi', cls: 'rekomendasi' },
    surat_pengantar:   { icon: 'bi-send',                label: 'Surat Pengantar',   cls: 'pengantar' },
    surat_panggilan:   { icon: 'bi-envelope-exclamation',label: 'Surat Panggilan',   cls: 'panggilan' },
    surat_izin:        { icon: 'bi-calendar-check',      label: 'Surat Izin',        cls: 'izin' },
    undangan:          { icon: 'bi-envelope-paper',      label: 'Undangan',          cls: 'undangan' },
    berita_acara:      { icon: 'bi-journal-text',        label: 'Berita Acara',      cls: 'berita_acara' },
    surat_edaran:      { icon: 'bi-megaphone',           label: 'Surat Edaran',      cls: 'edaran' },
  };

  const item = map[lower] ?? {
    icon: 'bi-file-earmark',
    label: raw || 'Surat',
    cls: 'default',
  };

  return (
    <span className={`ps-jenis-badge ps-jenis-badge--${item.cls}`}>
      <i className={`bi ${item.icon}`} />
      {item.label}
    </span>
  );
}
