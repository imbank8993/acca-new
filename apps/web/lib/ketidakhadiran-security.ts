import { NextRequest } from 'next/server';
import { extractRequestToken } from './app-jwt';
import { fetchMyAccess } from './nest-api';
import { getCloudflareConfig } from './file-storage';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

export const MEDICAL_LETTERS = ['UKS', 'SAKIT', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL', 'REKAPAN_SAKIT'];
export const LETTER_TYPES = ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN', 'IZIN', 'TUGAS', 'M', 'P', 'REKAPAN_IZIN', ...MEDICAL_LETTERS];

// Fetch live account access: do not fall back to stale JWT roles for writes.
export async function letterActor(request: NextRequest) {
  const token = extractRequestToken(request);
  if (!token) return null;
  const access = await fetchMyAccess(token);
  if (!access?.user) return null;
  const user: any = access.user;
  return { id: String(user.id), nama: user.nama_lengkap || user.nama || user.username || '', nip: user.nip || '',
    roles: access.access.roles.map(r => r.toUpperCase()), pages: access.access.pageIds };
}

export function mayManageLetter(actor: NonNullable<Awaited<ReturnType<typeof letterActor>>>, type: string, nomor = '') {
  const admin = actor.roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r));
  const medical = MEDICAL_LETTERS.includes(type) || nomor.includes('/UKS/');
  const roleAllowed = ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN'].includes(type)
    ? actor.roles.some(r => ['OP_IZIN', 'OP_UKS'].includes(r))
    : actor.roles.includes(medical ? 'OP_UKS' : 'OP_IZIN');
  return admin || (roleAllowed && actor.pages.some(p => ['ketidakhadiran', 'ketidakhadiran-daftar'].includes(p)));
}

function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 88, 168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Fail closed on literal or resolved IPv6; storage hosts normally offer IPv4.
  return false;
}

export async function fetchLetterArchive(value: string): Promise<Uint8Array | null> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.pathname.toLowerCase().endsWith('.pdf')) return null;
  const config = await getCloudflareConfig();
  const bases = [config?.publicUrl, config?.cdnDomain, process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, ...(process.env.LETTER_ARCHIVE_BASE_URLS || '').split(',')].filter(Boolean) as string[];
  const allowed = bases.some(base => {
    try { const b = new URL(base.startsWith('http') ? base : `https://${base}`); return b.protocol === 'https:' && url.origin === b.origin && url.pathname.startsWith(b.pathname.replace(/\/$/, '') + '/'); } catch { return false; }
  });
  if (!allowed) return null;
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(x => !publicAddress(x.address))) return null;
  const MAX = 20 * 1024 * 1024;
  // Pin the connection to a checked address, while retaining hostname TLS
  // verification. No redirect is followed, including redirects to internal IPs.
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      signal: AbortSignal.timeout(10000),
      lookup: (_hostname, options, callback) => {
        if ((options as { all?: boolean }).all) (callback as any)(null, [addresses[0]]);
        else (callback as any)(null, addresses[0].address, 4);
      },
    }, response => {
      if (response.statusCode !== 200 || Number(response.headers['content-length'] || 0) > MAX) {
        response.destroy(); resolve(null); return;
      }
      const chunks: Buffer[] = []; let length = 0;
      response.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > MAX) { response.destroy(); resolve(null); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.subarray(0, 5).toString() === '%PDF-' ? buffer : null);
      });
    });
    req.on('error', reject);
    req.end();
  });
}
