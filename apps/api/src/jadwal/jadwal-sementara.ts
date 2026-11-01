import { BadRequestException, ConflictException } from '@nestjs/common';

export function tanggalSementara(value: unknown): string {
  const s = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) {
    throw new BadRequestException('Tanggal harus berupa tanggal kalender yang sah');
  }
  return s;
}

// Identitas baris dasar disertakan: tambalan usang tidak boleh menimpa versi baru.
export function tandaBaris(r: any): string {
  return [r.id, r.nip, r.nama_guru, r.mata_pelajaran, r.kode_guru, r.hari, r.jam_ke, r.kelas, r.ruang].map(v => String(v ?? '')).join('|');
}

export function terapkanSementara(rows: any[], records: any[]): any[] {
  const edits = new Map<string, any>();
  for (const record of records) {
    const changes = record.perubahan as any[];
    // Satu pertukaran harus diterapkan utuh atau diabaikan utuh.
    if (!changes.every(c => rows.some(r => String(r.id) === c.id && tandaBaris(r) === c.asal))) continue;
    for (const c of changes) edits.set(c.id, c);
  }
  return rows.map(r => {
    const c = edits.get(String(r.id));
    return c ? { ...r, ...c.pengganti, jadwal_sementara: true } : r;
  });
}

export function pastikanBebasBentrok(rows: any[], changedIds: string[], jenis: string) {
  if (jenis !== 'mengajar') return; // Piket satu guru memang mencakup beberapa kelas.
  const changed = new Set(changedIds);
  const seen = new Map<string, any>();
  for (const r of rows) {
    const k = `${String(r.nip).replace(/^0+/, '')}|${r.hari}|${Number(r.jam_ke)}`;
    const other = seen.get(k);
    if (other && (changed.has(String(r.id)) || changed.has(String(other.id)))) {
      throw new ConflictException(`${r.nama_guru}: bentrok pada ${r.hari} jam ke-${r.jam_ke}`);
    }
    seen.set(k, r);
  }
}
