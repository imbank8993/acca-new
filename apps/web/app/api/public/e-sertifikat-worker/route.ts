import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
export const runtime = 'nodejs';
// Local, version-matched PDF renderer worker. This endpoint contains no user data.
export async function GET() {
    const resolveRuntime = createRequire(import.meta.url);
    const bytes = await readFile(resolveRuntime.resolve('pdfjs-dist/build/pdf.worker.min.js'));
    return new Response(bytes, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}
