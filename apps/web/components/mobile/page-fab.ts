/**
 * Registri aksi utama halaman (FAB tengah BottomNav).
 *
 * KENAPA STORE, BUKAN CustomEvent seperti sebelumnya
 * --------------------------------------------------
 * Dulu <MobileFab> memancarkan `acca:set-page-fab` dan BottomNav memasang
 * listener-nya. Event itu SESAAT: kalau halaman sempat memancarkannya sebelum
 * bilah nav sempat memasang telinga, aksinya hilang selamanya — tidak ada yang
 * mengumumkan ulang, dan tombol tengah diam-diam jatuh ke "Menu". Urutannya
 * bergantung pada hal-hal yang gampang bergeser: halaman di-lazy-load atau
 * tidak, role user sudah ada di cache atau masih diambil, hidrasi cepat atau
 * lambat. Jadi bug-nya muncul-hilang tanpa pola.
 *
 * Dengan store, pendaftarannya BERTAHAN. Bilah nav yang datang belakangan
 * tinggal membaca `getPageFab()` saat mount, lalu ikut `subscribePageFab()`
 * untuk perubahan berikutnya — hasilnya sama tidak peduli siapa duluan.
 *
 * Token identitas dipakai saat melepas: saat berpindah halaman, halaman baru
 * bisa mendaftar sebelum halaman lama sempat membersihkan diri. Tanpa token,
 * pembersihan si lama akan menghapus pendaftaran si baru.
 */

export type PageFab = {
    label: string
    icon: string
    run: () => void
}

/**
 * Dua sumber bisa mendaftar sekaligus di halaman yang sama:
 *
 * - `<MobileFab>` — pendaftaran EKSPLISIT, biasanya dengan label pendek yang
 *   memang ditulis untuk bilah nav ("Tambah", bukan "Tambah Tahun Ajaran").
 * - `<DesktopFab>` — pendaftaran OTOMATIS, supaya halaman yang cuma memasang
 *   FAB desktop tetap punya aksi di tombol tengah tanpa menulis apa pun lagi.
 *
 * Karena itu pendaftaran berprioritas, bukan siapa-terakhir-menang: urutan
 * efek React antara dua komponen bersaudara bukan sesuatu yang layak dijadikan
 * penentu tombol mana yang muncul.
 */
export const FAB_PRIORITY = {
    /** <DesktopFab>: dipakai kalau halaman tidak menyediakan yang eksplisit. */
    auto: 1,
    /** <MobileFab>: selalu menang. */
    explicit: 2,
} as const

type Entry = { token: object; fab: PageFab; priority: number; seq: number }

const entries: Entry[] = []
let seqCounter = 0
const listeners = new Set<(fab: PageFab | null) => void>()

/** Prioritas tertinggi; kalau seri, yang paling belakang mendaftar. */
function best(): Entry | null {
    return entries.reduce<Entry | null>((top, e) => {
        if (!top) return e
        if (e.priority > top.priority) return e
        if (e.priority === top.priority && e.seq > top.seq) return e
        return top
    }, null)
}

function emit() {
    const fab = best()?.fab ?? null
    listeners.forEach(listener => listener(fab))
}

/** Dipakai <MobileFab> & <DesktopFab>. `token` harus stabil sepanjang hidup komponennya. */
export function registerPageFab(token: object, fab: PageFab, priority: number = FAB_PRIORITY.explicit) {
    const existing = entries.findIndex(e => e.token === token)
    const entry: Entry = { token, fab, priority, seq: ++seqCounter }
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    emit()
}

/** Hanya menghapus pendaftaran milik token ini — lihat catatan token di atas. */
export function unregisterPageFab(token: object) {
    const i = entries.findIndex(e => e.token === token)
    if (i < 0) return
    entries.splice(i, 1)
    emit()
}

/** Aksi yang sedang terdaftar, atau null. Dibaca BottomNav saat mount. */
export function getPageFab(): PageFab | null {
    return best()?.fab ?? null
}

export function subscribePageFab(listener: (fab: PageFab | null) => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
