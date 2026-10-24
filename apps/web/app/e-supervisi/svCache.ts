'use client';

// Cache sederhana di sisi klien untuk data E-Supervisi.
// Tujuan: saat berpindah tab (komponen unmount/mount ulang), data yang sudah
// dimuat dipakai kembali tanpa fetch ulang ke server. Otomatis kadaluarsa via TTL
// dan bisa di-invalidate setelah operasi tulis (simpan/hapus/impor).

type Entry = { ts: number; data: any };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

const DEFAULT_TTL = 60_000; // 60 detik

/**
 * GET dengan cache. Mengembalikan JSON hasil parse.
 * Jika ada entri cache yang masih segar, langsung dikembalikan (tanpa jaringan).
 * Permintaan bersamaan untuk URL sama digabung (dedupe) agar tidak dobel fetch.
 */
export async function cachedGet(url: string, ttlMs: number = DEFAULT_TTL): Promise<any> {
    const key = url;
    const now = Date.now();

    const hit = store.get(key);
    if (hit && now - hit.ts < ttlMs) {
        return hit.data;
    }

    const existing = inflight.get(key);
    if (existing) return existing;

    const p = fetch(url, { cache: 'no-store' })
        .then(async (r) => {
            const json = await r.json().catch(() => ({ ok: false, error: 'Respons server tidak valid' }));
            // Respons gagal (403/500) tidak disimpan, supaya galat sesaat tidak
            // "menempel" selama TTL dan bisa langsung dicoba ulang.
            if (r.ok && json?.ok !== false) store.set(key, { ts: Date.now(), data: json });
            inflight.delete(key);
            return json;
        })
        .catch((e) => {
            inflight.delete(key);
            throw e;
        });

    inflight.set(key, p);
    return p;
}

/**
 * Hapus entri cache. Tanpa argumen: bersihkan semua.
 * Dengan prefix: hapus semua key yang mengandung prefix tsb (mis. semua varian
 * URL '/api/e-supervisi/penugasan' meski beda query param).
 */
export function invalidateSvCache(prefix?: string) {
    if (!prefix) {
        store.clear();
        return;
    }
    for (const k of Array.from(store.keys())) {
        if (k.includes(prefix)) store.delete(k);
    }
}
