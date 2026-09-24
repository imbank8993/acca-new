'use client';

interface StatusBadgeProps {
  status: 'pending' | 'disetujui' | 'ditolak';
}

interface JenisBadgeProps {
  jenis: 'izin' | 'sakit' | 'dinas_luar';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { icon: string; label: string }> = {
    pending:   { icon: 'bi-clock-fill',        label: 'Menunggu' },
    disetujui: { icon: 'bi-check-circle-fill', label: 'Disetujui' },
    ditolak:   { icon: 'bi-x-circle-fill',     label: 'Ditolak' },
  };
  const { icon, label } = map[status] ?? map.pending;
  return (
    <span className={`ig-badge ig-badge--${status}`}>
      <i className={`bi ${icon}`} />
      {label}
    </span>
  );
}

export function JenisBadge({ jenis }: JenisBadgeProps) {
  const map: Record<string, { icon: string; label: string }> = {
    izin:       { icon: 'bi-calendar-check', label: 'Izin' },
    sakit:      { icon: 'bi-heart-pulse',    label: 'Sakit' },
    dinas_luar: { icon: 'bi-briefcase',      label: 'Dinas Luar' },
  };
  const { icon, label } = map[jenis] ?? { icon: 'bi-question', label: jenis };
  return (
    <span className={`ig-jenis-badge ig-jenis-badge--${jenis}`}>
      <i className={`bi ${icon}`} />
      {label}
    </span>
  );
}
