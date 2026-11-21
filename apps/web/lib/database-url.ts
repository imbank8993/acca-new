/**
 * Lengkapi DATABASE_URL dengan ukuran pool koneksi Prisma yang eksplisit.
 *
 * Tanpa `connection_limit`, Prisma memakai (2 × jumlah core + 1) koneksi per
 * proses dan menunggu koneksi kosong hanya 10 detik. acca-api, acca-web, dan
 * CBT berbagi satu PostgreSQL (`max_connections` bawaan 100), jadi ukuran pool
 * tiap aplikasi sebaiknya ditentukan, bukan bergantung jumlah core VPS.
 *
 * Nilai yang sudah ada di DATABASE_URL selalu dihormati. String URL tidak
 * di-parse ulang agar kata sandi berkarakter khusus tidak berubah.
 */
export const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function withPoolDefaults(
  url: string | undefined,
  options: { limitEnv: string; defaultLimit: number },
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!url) return url;
  const additions: string[] = [];
  if (!/[?&]connection_limit=/i.test(url)) {
    additions.push(`connection_limit=${positiveInt(env[options.limitEnv], options.defaultLimit)}`);
  }
  if (!/[?&]pool_timeout=/i.test(url)) {
    additions.push(`pool_timeout=${positiveInt(env.DB_POOL_TIMEOUT, DEFAULT_POOL_TIMEOUT_SECONDS)}`);
  }
  if (!additions.length) return url;
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const separator = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${separator}${additions.join('&')}${hash}`;
}
