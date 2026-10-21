import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
// Local, version-matched PDF renderer worker. This endpoint contains no user data.
export async function GET() {
    // npm workspaces run from apps/web, while standalone runs can start at the
    // repository root. Avoid require.resolve: webpack can turn it into a numeric
    // module ID instead of a filesystem path. Tracing includes this worker file.
    for (const root of [process.cwd(), path.resolve(process.cwd(), '../..')]) {
        try {
            const bytes = await readFile(path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'));
            return new Response(bytes, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    return new Response('Pemuat PDF belum tersedia', { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
