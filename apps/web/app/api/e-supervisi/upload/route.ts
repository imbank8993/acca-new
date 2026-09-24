import { NextRequest, NextResponse } from 'next/server';
import { unregisterUpload } from '@/lib/storage/file-registry';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { POST as handleUpload } from '@/app/api/upload/route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        /**
         * `nestFetchAsUser` menerima TOKEN, bukan request. Di sini sebelumnya
         * `request` yang dioper, sehingga header yang terkirim ke NestJS
         * berbunyi `Bearer [object Object]` — panggilan pengecekan berkas lama
         * dan penyimpanan record berjalan tanpa identitas yang sah. Ditangkap
         * type-check sebagai TS2345, dan sekaligus memberi route ini gerbang
         * sesi yang sebelumnya tidak ada sama sekali.
         */
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const guru_nip = formData.get('guru_nip') as string;
        const tahun_ajaran_id = formData.get('tahun_ajaran_id') as string;
        const dokumen_id = formData.get('dokumen_id') as string;

        if (!file || !guru_nip || !tahun_ajaran_id || !dokumen_id) {
            return NextResponse.json({ ok: false, error: 'Data tidak lengkap' }, { status: 400 });
        }

        // Check existing record via NestJS
        const { body: existingBody } = await nestFetchAsUser(
            `/e-supervisi/unggahan?guru_nip=${encodeURIComponent(guru_nip)}&tahun_ajaran_id=${tahun_ajaran_id}`,
            token
        );
        const existingList = existingBody?.data || [];
        const existingRecord = existingList.find((r: any) => String(r.dokumen_id) === String(dokumen_id));

        if (existingRecord && existingRecord.file_url) {
            try {
                await unregisterUpload(existingRecord.file_url);
            } catch (e) {
                console.error('Failed to unregister old file:', e);
            }
        }
        
        // Delegate file upload to central upload route handler
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('folder', `e-supervisi/${tahun_ajaran_id}/${guru_nip}/${dokumen_id}`);

        // Header cookie ikut disalin supaya `extractRequestToken` di
        // /api/upload menemukan sesi pemanggil; handler-nya dipanggil langsung
        // sebagai fungsi, jadi tidak ada request asli yang membawa cookie.
        const uploadReq = new NextRequest(new URL('/api/upload', request.url), {
            method: 'POST',
            headers: { cookie: request.headers.get('cookie') || '' },
            body: uploadFormData,
        });

        const uploadRes = await handleUpload(uploadReq);
        const uploadJson = await uploadRes.json();

        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.publicUrl) {
            throw new Error(uploadJson.error || 'Gagal mengunggah berkas');
        }

        const publicUrl = uploadJson.publicUrl;
        
        // Save database record via NestJS
        const { status: recordStatus, body: recordBody } = await nestFetchAsUser(
            '/e-supervisi/unggahan/record',
            token,
            {
                method: 'POST',
                body: JSON.stringify({
                    guru_nip,
                    tahun_ajaran_id: parseInt(tahun_ajaran_id),
                    dokumen_id: parseInt(dokumen_id),
                    file_url: publicUrl,
                    file_name: file.name,
                    size_bytes: file.size,
                })
            }
        );
        
        if (recordStatus !== 200 && recordStatus !== 201) {
            throw new Error(recordBody?.message || 'Gagal menyimpan catatan unggahan di backend NestJS');
        }

        return NextResponse.json({ ok: true, data: recordBody?.data });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
