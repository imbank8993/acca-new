/**
 * API Route: Test kirim laporan sebagai GAMBAR ke WA.
 * Merender gambar contoh (piket/ketidakhadiran), upload ke storage, lalu kirim ke
 * target yang dipilih via provider terkonfigurasi. Mengembalikan RAW response provider
 * agar admin bisa melihat apakah paket (mis. Fonnte) mendukung pengiriman media/gambar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { renderHtmlToImage, REPORT_IMAGE_EXT } from '@/lib/report-image'
import { piketReportHtml, ketidakhadiranReportHtml } from '@/lib/report-templates'
import { uploadFile } from '@/lib/storage/storage-handler'

function sampleHtml(feature: string): string {
    if (feature === 'ketidakhadiran') {
        return ketidakhadiranReportHtml(
            { tanggal: 'Contoh Tanggal', petugas_nama: 'Petugas Uji', jenis: 'IZIN/SAKIT', total: '6', nama_sekolah: 'Sekolah (Uji Coba)' },
            [
                { no: '1', nama: 'Contoh Siswa A', nisn: '0000000001', kelas: 'X-1', status: 'Ringan', keterangan: 'Demam' },
                { no: '2', nama: 'Contoh Siswa B', nisn: '0000000002', kelas: 'X-2', status: 'Sedang', keterangan: 'Istirahat di UKS' },
                { no: '3', nama: 'Contoh Siswa C', nisn: '0000000003', kelas: 'XI-1', status: 'Berat', keterangan: 'Dijemput orang tua' },
                { no: '4', nama: 'Contoh Siswa D', nisn: '0000000004', kelas: 'XI-2', status: 'Kontrol', keterangan: 'Kontrol rutin' },
                { no: '5', nama: 'Contoh Siswa E', nisn: '0000000005', kelas: 'XII-1', status: 'Madrasah', keterangan: 'Lomba' },
                { no: '6', nama: 'Contoh Siswa F', nisn: '0000000006', kelas: 'XII-2', status: 'Personal', keterangan: 'Acara keluarga' },
            ]
        )
    }
    return piketReportHtml(
        { tanggal: 'Contoh Tanggal', hari: 'Contoh Hari', jam_ke: '1,2', nama_guru_piket: 'Guru Uji', waktu: '08:00', keterangan: 'Ini pesan uji coba mode gambar', nama_sekolah: 'Sekolah (Uji Coba)' },
        [
            { nama_kelas: 'X-1', nama_guru: 'Guru A', status_kehadiran: 'Sesuai', izin_sakit: '-' },
            { nama_kelas: 'X-2', nama_guru: 'Guru B', status_kehadiran: 'Jam Kosong', izin_sakit: 'Tidak Ada' },
            { nama_kelas: 'XI-1', nama_guru: 'Guru C', status_kehadiran: 'Terlambat', izin_sakit: '-' },
            { nama_kelas: 'XI-2', nama_guru: 'Guru D', status_kehadiran: 'Penugasan tanpa pendampingan', izin_sakit: 'Sakit' },
            { nama_kelas: 'XII-1', nama_guru: 'Guru E', status_kehadiran: 'Daring', izin_sakit: 'Izin' },
            { nama_kelas: 'XII-2', nama_guru: 'Guru F', guru_jadwal: 'Guru F', guru_pengganti: 'Guru G', status_kehadiran: 'Penugasan tanpa pendampingan', izin_sakit: 'Pending' },
        ]
    )
}

async function sendMedia(provider: string, token: string, target: string, imageUrl: string, caption: string): Promise<{ ok: boolean; raw: any }> {
    try {
        if (provider === 'baileys') {
            const { baileysSendImage } = await import('@/lib/baileys')
            const r = await baileysSendImage(target, imageUrl, caption)
            return { ok: r.ok, raw: r.ok ? { detail: 'terkirim via Baileys' } : { error: r.error } }
        }
        if (provider === 'watzap') {
            const res = await fetch('https://www.watzap.me/api/send_image_url', {
                method: 'POST',
                headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: target, url: imageUrl, caption }),
            })
            const raw = await res.json().catch(() => null)
            return { ok: raw?.success === true, raw }
        }
        if (provider === 'ultramsg') {
            const res = await fetch(`https://api.ultramsg.com/instance/${token}/messages/image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, to: target, image: imageUrl, caption }),
            })
            const raw = await res.json().catch(() => null)
            return { ok: raw?.sent === true || raw?.success === true, raw }
        }
        // default: fonnte
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, url: imageUrl, message: caption }),
        })
        const raw = await res.json().catch(() => null)
        const ok = raw?.status === true ||
            (typeof raw?.detail === 'string' && /kirim|sent|pending/i.test(raw.detail))
        return { ok, raw }
    } catch (err: any) {
        return { ok: false, raw: { error: err?.message || String(err) } }
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { feature = 'piket', token, targets, provider = 'fonnte' } = body

        if ((provider !== 'baileys' && !token) || !Array.isArray(targets) || targets.length === 0) {
            return NextResponse.json({ ok: false, error: 'Token dan minimal satu target wajib diisi' }, { status: 400 })
        }

        // 1. Render gambar contoh
        let buffer: Buffer
        try {
            buffer = await renderHtmlToImage(sampleHtml(feature))
        } catch (err: any) {
            return NextResponse.json({
                ok: false,
                stage: 'render',
                error: `Gagal merender gambar (Puppeteer). Di server pastikan Chromium terpasang: 'npx puppeteer browsers install chrome'. Detail: ${err?.message || err}`,
            }, { status: 500 })
        }

        // 2. Upload ke storage
        const uploaded = await uploadFile(buffer, `test-${feature}-${Date.now()}.${REPORT_IMAGE_EXT}`, 'wa-reports')
        if (!uploaded.ok || !uploaded.file_url) {
            return NextResponse.json({ ok: false, stage: 'upload', error: uploaded.error || 'Gagal upload gambar ke storage' }, { status: 500 })
        }

        // 3. Kirim ke tiap target, kumpulkan raw response provider
        const caption = `🧪 Test Laporan Gambar (${feature}) — Sistem ACCA`
        const results: Array<{ target: string; ok: boolean; raw: any }> = []
        for (const target of targets) {
            const r = await sendMedia(provider, token, String(target), uploaded.file_url, caption)
            results.push({ target: String(target), ...r })
        }

        const successCount = results.filter(r => r.ok).length
        return NextResponse.json({
            ok: successCount > 0,
            imageUrl: uploaded.file_url,
            successCount,
            total: results.length,
            results,
        })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Terjadi kesalahan server' }, { status: 500 })
    }
}
