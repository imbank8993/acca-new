import { NextRequest, NextResponse } from 'next/server';
import { getUploadConfig } from '@/lib/file-storage';
import { verifyAppToken, extractRequestToken } from '@/lib/app-jwt';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const folderName = searchParams.get('folder_name') || 'others';

        const token = extractRequestToken(request);
        const claims = token ? await verifyAppToken(token) : null;

        if (!claims?.sub) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get upload configuration from NestJS
        const uploadConfig = await getUploadConfig();

        if (!uploadConfig.storageType) {
            return NextResponse.json({
                ok: false,
                error: 'Konfigurasi penyimpanan file belum diset.'
            }, { status: 500 });
        }

        const storagePath = `${claims.username || claims.sub}/${folderName}`;

        return NextResponse.json({
            ok: true,
            storageType: uploadConfig.storageType,
            bucketName: uploadConfig.bucketName,
            googleDriveFolderId: uploadConfig.googleDriveFolderId,
            cloudflareConfig: uploadConfig.cloudflareConfig,
            storagePath: storagePath
        });

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}