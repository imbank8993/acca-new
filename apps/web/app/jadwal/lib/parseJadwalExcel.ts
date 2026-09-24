export interface GuruMapelEntry {
    nip: string
    nama_guru: string
    kode_guru: string
    nama_mapel: string
    kode_mapel?: string | null
}

export interface KelasEntry {
    nama: string
    kode?: string | null
}

export interface ParsedScheduleEntry {
    nip: string
    nama_guru: string
    mata_pelajaran: string
    kelas: string
    ruang: string
}

export interface ParseCellResult {
    entries: ParsedScheduleEntry[]
    error: string | null
}

/**
 * Parses one Excel cell ("KODE_GURU KODE_MAPEL") from the jadwal-guru generate grid.
 * The column header (`roomName`) is a physical ROOM, not necessarily a class: a room can
 * host a regular class on one period and a peminatan/UTBK group on another. Peminatan is
 * signaled by a trailing numeric index on the mapel code (e.g. "FIS1", "FIS2"); codes without
 * a trailing index are regular subjects and resolve the class to the room name itself.
 */
export function parseJadwalCell(
    cellStr: string,
    roomName: string,
    guruMapelByNama: Map<string, GuruMapelEntry[]>,
    guruMapelByKode: Map<string, GuruMapelEntry[]>,
    kelasByNama: Map<string, KelasEntry>,
    kelasByKode: Map<string, KelasEntry>
): ParseCellResult {
    const trimmed = cellStr.trim()
    // Split by spaces, commas, slashes, or ampersands to support multiple pairs in one cell
    const parts = trimmed.split(/[\s,\/&]+/).filter(p => p.trim() !== '')

    if (parts.length === 0) {
        return { entries: [], error: null }
    }

    if (parts.length % 2 !== 0) {
        return { entries: [], error: `Format tidak valid "${trimmed}". Harus berpasangan KODE_GURU KODE_MAPEL (contoh: "MDJ FIS" atau "MDJ FIS, ABC KIR")` }
    }

    const allEntries: ParsedScheduleEntry[] = []

    for (let i = 0; i < parts.length; i += 2) {
        const kodeGuru = parts[i]
        const part2 = parts[i + 1]

        // 1) Coba cocokkan langsung — jalur REGULER, identik dengan perilaku sebelum peminatan ada.
        let directEntries = guruMapelByNama.get(`${kodeGuru}|${part2}`)
        if (!directEntries || directEntries.length === 0) {
            directEntries = guruMapelByKode.get(`${kodeGuru}|${part2}`)
        }

        if (directEntries && directEntries.length > 0) {
            const kelasEntry = kelasByNama.get(roomName)
            if (!kelasEntry) {
                return { entries: [], error: `Ruang "${roomName}" bukan kelas reguler terdaftar di Master Kelas. Jika ini sesi peminatan, gunakan kode kelompok (mis. "${part2}1"), bukan "${part2}".` }
            }
            if (kelasEntry.kode) {
                return { entries: [], error: `Ruang "${roomName}" terdaftar sebagai kelompok peminatan (kode "${kelasEntry.kode}"), bukan kelas reguler. Sel "${trimmed}" harus memakai kode kelompok, bukan format reguler.` }
            }
            
            for (const gm of directEntries) {
                allEntries.push({
                    nip: gm.nip,
                    nama_guru: gm.nama_guru,
                    mata_pelajaran: gm.nama_mapel,
                    kelas: roomName,
                    ruang: roomName,
                })
            }
            continue
        }

        // 2) Tidak ada match langsung — coba jalur PEMINATAN: lepas indeks angka di ujung kode mapel.
        const baseKode = part2.replace(/\d+$/, '')
        if (baseKode === part2) {
            // Tidak ada indeks untuk dilepas — memang tidak ditemukan, bukan percobaan peminatan.
            return { entries: [], error: `"${kodeGuru} ${part2}" tidak ditemukan di tab "Guru Mapel".` }
        }

        const baseEntries = guruMapelByKode.get(`${kodeGuru}|${baseKode}`)
        if (!baseEntries || baseEntries.length === 0) {
            return { entries: [], error: `Kode mapel dasar "${baseKode}" (dari "${part2}") untuk guru "${kodeGuru}" tidak ditemukan di tab "Guru Mapel".` }
        }

        const kelompokEntry = kelasByKode.get(part2)
        if (!kelompokEntry) {
            return { entries: [], error: `Kode kelompok peminatan "${part2}" belum terdaftar di Master Kelas. Tambahkan kelas baru dengan Kode = "${part2}".` }
        }

        for (const gm of baseEntries) {
            allEntries.push({
                nip: gm.nip,
                nama_guru: gm.nama_guru,
                mata_pelajaran: gm.nama_mapel,
                kelas: kelompokEntry.nama,
                ruang: roomName,
            })
        }
    }

    return { entries: allEntries, error: null }
}
