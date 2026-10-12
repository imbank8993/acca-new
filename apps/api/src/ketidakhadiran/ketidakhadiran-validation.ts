import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function boundedInt(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new BadRequestException('Parameter angka tidak valid');
  return Math.min(n, max);
}

export function validDate(value: unknown): Date {
  const text = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : String(value || '').split('T')[0];
  const date = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text)
    throw new BadRequestException('Tanggal tidak valid');
  return date;
}

export function validatePeriod(body: any) {
  const start = validDate(body.tgl_mulai || body.tanggal);
  const end = validDate(body.tgl_selesai || body.tgl_selesai_sakit || body.tgl_mulai || body.tanggal);
  if (end < start || end.getTime() - start.getTime() > 366 * 86400000) throw new BadRequestException('Rentang tanggal tidak valid (maksimal 366 hari)');
  for (const key of ['waktu', 'waktu_mulai_real', 'waktu_selesai_real', 'waktu_selesai', 'waktu_selesai_uks']) {
    if (body[key] && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(body[key]))) throw new BadRequestException('Waktu tidak valid');
  }
  const a = body.waktu_mulai_real || body.waktu;
  const b = body.waktu_selesai_real || body.waktu_selesai || body.waktu_selesai_uks;
  if (a && b && String(b) <= String(a) && (!body.is_kontinu || start.getTime() === end.getTime())) throw new BadRequestException('Waktu selesai harus setelah waktu mulai');
}

export function validateText(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Data permintaan tidak valid');
  for (const [key, value] of Object.entries(body || {})) {
    if (typeof value === 'string' && value.length > 10000) throw new BadRequestException(`Teks ${key} terlalu panjang`);
    if (Array.isArray(value) && (value.length > 500 || value.some(x => typeof x === 'string' && x.length > 1000))) throw new BadRequestException(`Daftar ${key} terlalu panjang`);
  }
  for (const key of ['riwayat_penyakit', 'riwayat_alergi_obat', 'tindakan']) {
    if (Array.isArray(body[key]) && body[key].some((x: unknown) => typeof x !== 'string')) throw new BadRequestException(`Daftar ${key} tidak valid`);
  }
  for (const key of ['auto_sync', 'auto_sync_ketidakhadiran', 'sync_ketidakhadiran', 'is_kontinu']) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new BadRequestException(`Nilai ${key} harus boolean`);
  }
  for (const key of ['nisn', 'nama_siswa', 'keluhan', 'tata_laksana', 'tindak_lanjut', 'status', 'jenis', 'keterangan', 'file_url', 'mappedStatus', 'mapped_status']) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== 'string') throw new BadRequestException(`Teks ${key} tidak valid`);
  }
  for (const [key, max] of Object.entries({ nisn: 20, nama_siswa: 255, tindak_lanjut: 100, status: 50, jenis: 20 })) {
    if (typeof body[key] === 'string' && body[key].length > max) throw new BadRequestException(`Teks ${key} terlalu panjang`);
  }
}

export function validateQuery(query: any) {
  validateText(query);
  if (Object.values(query).some(v => v !== undefined && !['string', 'number', 'boolean'].includes(typeof v))) throw new BadRequestException('Parameter pencarian tidak valid');
}

export function canManageJenis(user: any, jenis: string) {
  if (!['IZIN', 'SAKIT'].includes(jenis)) throw new BadRequestException('Jenis ketidakhadiran harus IZIN atau SAKIT');
  if (!user || (!user.isAdmin && !user.roles?.some((r: string) => ['ADMIN', 'ADMINISTRATOR', jenis === 'SAKIT' ? 'OP_UKS' : 'OP_IZIN'].includes(r)))) throw new ForbiddenException('Tidak memiliki hak untuk jenis data ini');
}

export function validateStatus(jenis: string, status: unknown) {
  if (!(jenis === 'SAKIT' ? ['Ringan', 'Sedang', 'Berat', 'Kontrol'] : ['MADRASAH', 'PERSONAL']).includes(String(status))) throw new BadRequestException('Status tidak sesuai jenis ketidakhadiran');
}

export function medicalStatus(followup: string, presets?: any): string {
  const configured = presets?.tindakLanjutMapping?.find((m: any) => String(m.name).toLowerCase() === String(followup).toLowerCase());
  if (configured && ['NONE', 'Ringan', 'Sedang', 'Berat', 'Kontrol'].includes(configured.status)) return configured.status;
  const text = String(followup || '').toLowerCase();
  if (text.includes('kembali ke kelas')) return 'NONE';
  if (text.includes('kontrol')) return 'Kontrol';
  if (text.includes('opname')) return 'Berat';
  if (/pulang|dijemput|rujuk|klinik|\brs\b/.test(text)) return 'Sedang';
  return 'Ringan';
}

export function absenceJp(r: any): number {
  const start = validDate(r.tgl_mulai), end = validDate(r.tgl_selesai);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const minutes = (v: any, fallback: number) => {
    if (!v) return fallback;
    const text = v instanceof Date ? v.toISOString().slice(11, 16) : String(v).includes('T') ? String(v).slice(11, 16) : String(v);
    const [h, m] = text.split(':').map(Number);
    return h * 60 + m;
  };
  const a = minutes(r.waktu_mulai_real, 0), b = minutes(r.waktu_selesai_real, 1440);
  return (r.is_kontinu && days > 1 ? Math.max(0, (days - 1) * 1440 - a + b) : Math.max(0, b - a) * days) / 60;
}
