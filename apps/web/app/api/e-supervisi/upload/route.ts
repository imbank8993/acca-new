import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { POST as handleUpload, DELETE as handleDeleteUpload } from '@/app/api/upload/route';

export const dynamic = 'force-dynamic';

/** Berkas supervisi ditampilkan di penampil PDF supervisor, jadi hanya PDF yang diterima. */
const MAKS_UKURAN = 20 * 1024 * 1024; // 20 MB

const gagal = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return gagal('Unauthorized', 401);

        const formData = await request.formData();
        const file = formData.get('file');
        const guru_nip = String(formData.get('guru_nip') || '').trim();
        const tahun_ajaran_id = String(formData.get('tahun_ajaran_id') || '').trim();
        const dokumen_id = String(formData.get('dokumen_id') || '').trim();

        if (!(file instanceof File) || !guru_nip || !/^\d+$/.test(tahun_ajaran_id) || !/^\d+$/.test(dokumen_id)) {
            return gagal('Data tidak lengkap', 400);
        }
        const isPdf = /\.pdf$/i.test(file.name) && (!file.type || file.type === 'application/pdf');
        if (!isPdf) return gagal('Dokumen supervisi harus berformat PDF', 400);
        if (file.size <= 0 || file.size > MAKS_UKURAN) return gagal('Ukuran berkas maksimal 20 MB', 400);

        // Periksa hak & kelayakan SEBELUM berkas dikirim ke penyimpanan:
        // NIP harus milik sesi, dokumen milik tahun ajaran tsb, dan penilaian
        // belum dikunci. Sebelumnya berkas lama orang lain bisa dicabut dari
        // registri hanya dengan mengirim guru_nip milik orang tersebut.
        const cek = await nestFetchAsUser('/e-supervisi/unggahan/cek', token, {
            method: 'POST',
            body: JSON.stringify({ guru_nip, tahun_ajaran_id: Number(tahun_ajaran_id), dokumen_id: Number(dokumen_id) }),
        });
        if (cek.status !== 200 && cek.status !== 201) {
            return gagal(cek.body?.message || cek.body?.error || 'Unggahan ditolak', cek.status || 400);
        }

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('folder', `e-supervisi/${tahun_ajaran_id}/${guru_nip}/${dokumen_id}`);

        // Header cookie ikut disalin supaya `extractRequestToken` di
        // /api/upload menemukan sesi pemanggil; handler-nya dipanggil langsung
        // sebagai fungsi, jadi tidak ada request asli yang membawa cookie.
        const authHeaders = {
            cookie: request.headers.get('cookie') || '',
            authorization: request.headers.get('authorization') || '',
        };
        const uploadReq = new NextRequest(new URL('/api/upload', request.url), {
            method: 'POST',
            headers: authHeaders,
            body: uploadFormData,
        });

        const uploadRes = await handleUpload(uploadReq);
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
            return gagal(uploadJson.error || 'Gagal mengunggah berkas', uploadRes.status >= 400 ? uploadRes.status : 502);
        }
        const publicUrl: string = uploadJson.publicUrl;

        // Simpan catatan unggahan. Backend juga menghapus berkas lama yang digantikan.
        const { status: recordStatus, body: recordBody } = await nestFetchAsUser('/e-supervisi/unggahan/record', token, {
            method: 'POST',
            body: JSON.stringify({
                guru_nip,
                tahun_ajaran_id: Number(tahun_ajaran_id),
                dokumen_id: Number(dokumen_id),
                file_url: publicUrl,
                file_name: file.name,
                size_bytes: file.size,
            }),
        });

        if (recordStatus !== 200 && recordStatus !== 201) {
            // Catatan gagal: jangan tinggalkan berkas yatim di penyimpanan.
            try {
                const delUrl = new URL('/api/upload', request.url);
                delUrl.searchParams.set('file_url', publicUrl);
                await handleDeleteUpload(new NextRequest(delUrl, { method: 'DELETE', headers: authHeaders }));
            } catch (e) {
                console.error('[e-supervisi/upload] Gagal membersihkan berkas setelah pencatatan gagal:', e);
            }
            return gagal(recordBody?.message || 'Gagal menyimpan catatan unggahan', recordStatus || 500);
        }

        return NextResponse.json({ ok: true, data: recordBody?.data });
    } catch (error: any) {
        console.error('[e-supervisi/upload]', error);
        return gagal('Terjadi kesalahan saat mengunggah dokumen', 500);
    }
}
