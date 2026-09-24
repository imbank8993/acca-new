import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SanggarService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const { search, pilihan_sanggar, kelas_pelatihan, nip } = query || {};
    const where: any = {};

    if (nip) where.nip = String(nip);
    if (pilihan_sanggar) where.pilihan_sanggar = String(pilihan_sanggar);
    if (kelas_pelatihan) where.kelas_pelatihan = String(kelas_pelatihan);

    if (search) {
      where.OR = [
        { nama: { contains: String(search), mode: 'insensitive' } },
        { nip: { contains: String(search), mode: 'insensitive' } },
        { asal_sekolah: { contains: String(search), mode: 'insensitive' } },
        { nomor_wa: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.registrasi_sanggar.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return { ok: true, data };
  }

  async findOne(id: string) {
    const item = await this.prisma.registrasi_sanggar.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Data pendaftaran sanggar tidak ditemukan');
    return { ok: true, data: item };
  }

  async create(payload: any) {
    const {
      nama,
      nip,
      asal_sekolah,
      alamat,
      nomor_wa,
      email,
      pilihan_sanggar,
      kelas_pelatihan,
      sumber_aplikasi,
      pas_foto,
    } = payload;

    if (!nama || !asal_sekolah || !alamat || !nomor_wa || !pilihan_sanggar || !kelas_pelatihan) {
      throw new BadRequestException('Field wajib harus diisi');
    }

    const item = await this.prisma.registrasi_sanggar.create({
      data: {
        nama: String(nama),
        nip: nip ? String(nip) : null,
        asal_sekolah: String(asal_sekolah),
        alamat: String(alamat),
        nomor_wa: String(nomor_wa),
        email: email ? String(email) : null,
        pilihan_sanggar: String(pilihan_sanggar),
        kelas_pelatihan: String(kelas_pelatihan),
        sumber_aplikasi: sumber_aplikasi ? String(sumber_aplikasi) : 'acca-app',
        pas_foto: pas_foto ? String(pas_foto) : null,
      },
    });

    return { ok: true, data: item };
  }

  async update(id: string, payload: any) {
    const existing = await this.prisma.registrasi_sanggar.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Data pendaftaran tidak ditemukan');

    const updateData: any = {};
    if (payload.nama !== undefined) updateData.nama = String(payload.nama);
    if (payload.nip !== undefined) updateData.nip = payload.nip ? String(payload.nip) : null;
    if (payload.asal_sekolah !== undefined) updateData.asal_sekolah = String(payload.asal_sekolah);
    if (payload.alamat !== undefined) updateData.alamat = String(payload.alamat);
    if (payload.nomor_wa !== undefined) updateData.nomor_wa = String(payload.nomor_wa);
    if (payload.email !== undefined) updateData.email = payload.email ? String(payload.email) : null;
    if (payload.pilihan_sanggar !== undefined) updateData.pilihan_sanggar = String(payload.pilihan_sanggar);
    if (payload.kelas_pelatihan !== undefined) updateData.kelas_pelatihan = String(payload.kelas_pelatihan);
    if (payload.pas_foto !== undefined) updateData.pas_foto = payload.pas_foto ? String(payload.pas_foto) : null;
    if (payload.wa_last_status !== undefined) updateData.wa_last_status = payload.wa_last_status;
    if (payload.wa_sent_at !== undefined) updateData.wa_sent_at = payload.wa_sent_at ? new Date(payload.wa_sent_at) : null;

    const updated = await this.prisma.registrasi_sanggar.update({
      where: { id },
      data: updateData,
    });

    return { ok: true, data: updated };
  }

  async delete(id: string) {
    const existing = await this.prisma.registrasi_sanggar.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Data pendaftaran tidak ditemukan');

    await this.prisma.registrasi_sanggar.delete({ where: { id } });
    return { ok: true, message: 'Data berhasil dihapus' };
  }

  async check(nipParam?: string, namaParam?: string) {
    const normText = (s: any) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const normNip = (s: any) => String(s || '').replace(/\D/g, '');

    const nip = normNip(nipParam);
    const nama = normText(namaParam);

    if (!nip && !nama) {
      throw new BadRequestException('Parameter nip atau nama wajib diisi');
    }

    const data = await this.prisma.registrasi_sanggar.findMany({
      select: { id: true, nama: true, nip: true, pilihan_sanggar: true, kelas_pelatihan: true, created_at: true },
    });

    const existing = (data || []).find((r) => {
      if (nip && normNip(r.nip) === nip) return true;
      if (nama && normText(r.nama) === nama) return true;
      return false;
    }) || null;

    return { ok: true, data: existing };
  }

  async getKuota() {
    const settingRow = await this.prisma.site_settings.findFirst({
      where: { key: 'sanggar_config' },
      select: { value: true },
    });

    if (!settingRow?.value) {
      throw new NotFoundException('Konfigurasi sanggar tidak ditemukan');
    }

    const config: Array<{ sanggar: string; aktif?: boolean; kelas: Array<{ nama: string; kuota: number }> }> = JSON.parse(settingRow.value);
    config.sort((a, b) => a.sanggar.localeCompare(b.sanggar, 'id', { numeric: true, sensitivity: 'base' }));
    config.forEach((s) => {
      s.kelas.sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true, sensitivity: 'base' }));
    });

    const registrations = await this.prisma.registrasi_sanggar.findMany({
      select: { pilihan_sanggar: true, kelas_pelatihan: true },
    });

    const countMap: Record<string, number> = {};
    for (const r of registrations || []) {
      const key = `${r.pilihan_sanggar}||${r.kelas_pelatihan}`;
      countMap[key] = (countMap[key] || 0) + 1;
    }

    const result = config.map((s) => ({
      sanggar: s.sanggar,
      aktif: s.aktif !== false,
      kelas: s.kelas.map((k) => {
        const key = `${s.sanggar}||${k.nama}`;
        const terisi = countMap[key] || 0;
        const kuotaValue = (k.kuota as any) === '' || (k.kuota as any) === null || (k.kuota as any) === undefined ? null : Number(k.kuota);
        const penuh = kuotaValue !== null && terisi >= kuotaValue;
        return {
          nama: k.nama,
          kuota: kuotaValue,
          terisi,
          sisa: kuotaValue !== null ? Math.max(0, kuotaValue - terisi) : null,
          penuh,
        };
      }),
    }));

    return { data: result };
  }

  async getBroadcastConfig() {
    const configRow = await this.prisma.site_settings.findFirst({
      where: { key: 'sanggar_wa_config' },
      select: { value: true },
    });
    let config = {};
    if (configRow?.value) {
      try { config = JSON.parse(configRow.value); } catch {}
    }

    const provider1 = await this.prisma.site_settings.findFirst({ where: { key: 'wa_provider_sanggar' }, select: { value: true } });
    const provider2 = await this.prisma.site_settings.findFirst({ where: { key: 'wa_provider' }, select: { value: true } });
    const provider = provider1?.value || provider2?.value || 'fonnte';

    let hasToken = false;
    if (provider === 'baileys') {
      hasToken = true;
    } else {
      const tokenRow = await this.prisma.site_settings.findFirst({ where: { key: 'wa_token_sanggar' }, select: { value: true } });
      hasToken = !!(tokenRow?.value && tokenRow.value.trim());
    }

    return { ok: true, config, hasToken };
  }

  async postBroadcast(body: any) {
    const action = body?.action;

    if (action === 'save-config') {
      const config = body.config || {};
      await this.prisma.site_settings.upsert({
        where: { key: 'sanggar_wa_config' },
        create: {
          key: 'sanggar_wa_config',
          label: 'Konfigurasi Broadcast WA Sanggar',
          description: 'Link grup & template pesan WA per kelas pelatihan',
          value: JSON.stringify(config),
          is_active: true,
        },
        update: {
          value: JSON.stringify(config),
          is_active: true,
        },
      });
      return { ok: true };
    }

    if (action === 'save-token') {
      const token = String(body.token || '').trim();
      await this.prisma.site_settings.upsert({
        where: { key: 'wa_token_sanggar' },
        create: {
          key: 'wa_token_sanggar',
          label: 'Token WA Sanggar',
          description: 'Token gateway WhatsApp (Fonnte) untuk broadcast sanggar',
          value: token,
          is_active: true,
        },
        update: {
          value: token,
          is_active: true,
        },
      });
      return { ok: true };
    }

    if (action === 'preview') {
      const kelas = String(body.kelas || '');
      const configRow = await this.prisma.site_settings.findFirst({ where: { key: 'sanggar_wa_config' }, select: { value: true } });
      let config: any = {};
      if (configRow?.value) {
        try { config = JSON.parse(configRow.value); } catch {}
      }
      const kc = config[kelas] || {};
      const sample = await this.prisma.registrasi_sanggar.findFirst({
        where: { kelas_pelatihan: kelas },
        select: { nama: true, pilihan_sanggar: true, kelas_pelatihan: true },
      });
      
      let out = kc.template || '';
      const vars: Record<string, string> = {
        nama: sample?.nama || 'Nama Peserta',
        kelas: kelas,
        sanggar: sample?.pilihan_sanggar || '',
        link_grup: kc.link_grup || '(link grup belum diisi)',
      };
      for (const [k, v] of Object.entries(vars)) {
        out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v ?? '');
      }

      return { ok: true, message: out };
    }

    return { ok: false, error: 'Aksi tidak dikenal' };
  }
}


