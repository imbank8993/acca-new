import { prisma } from '@/lib/prisma';
import { JadwalGuru, JurnalGuru, Libur } from '../types';
import { buildLiburIndex, type KelasContext } from '@/lib/libur';

function getIndonesianDayName(date: Date): string {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[date.getDay()];
}

export const JurnalService = {
    /**
     * Apakah satu slot (tanggal + jam) libur untuk kelas tertentu.
     *
     * `ctx` wajib diisi kalau liburnya mungkin berlingkup kelas/tingkat —
     * tanpa itu libur parsial tidak akan terdeteksi. Lihat lib/libur.ts.
     */
    async isHoliday(date: string, jam_ke: number, ctx: KelasContext = {}): Promise<boolean> {
        try {
            const data = await prisma.libur.findMany({
                where: { tanggal: date }
            });
            return buildLiburIndex(data as unknown as Libur[]).isLibur(date, jam_ke, ctx);
        } catch (error) {
            console.error('Error checking holiday:', error);
            return false;
        }
    },

    // Get active schedule for a specific day
    async getJadwalByDay(hari: string): Promise<JadwalGuru[]> {
        const data = await prisma.jadwal_guru.findMany({
            where: { hari, aktif: true }
        });
        return data as any || [];
    },

    // OPTIMIZED: Generate journals for a date range using batch processing
    // Key fix: each (nip, kelas, jam_ke) slot = 1 journal entry per date
    // Schedule versions by tanggal_mulai_berlaku are handled correctly
    async generateJurnal(startDate: string, endDate: string, jamKeFilter: number[] = []) {
        const results = {
            generated: 0,
            skipped_holiday: 0,
            skipped_existing: 0,
            skipped_no_schedule: 0,
            debug: [] as string[],
            errors: [] as string[]
        };
        // Step 1: Collect all dates and their day names (Timezone safe)
        const datesInfo: { dateStr: string, dayName: string }[] = [];
        const [startY, startM, startD] = startDate.split('-').map(Number);
        const [endY, endM, endD] = (endDate || startDate).split('-').map(Number);
        
        let curr = new Date(startY, startM - 1, startD);
        const last = new Date(endY, endM - 1, endD);

        while (curr <= last) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            
            datesInfo.push({
                dateStr,
                dayName: getIndonesianDayName(curr)
            });
            curr.setDate(curr.getDate() + 1);
        }

        if (datesInfo.length === 0) return results;

        const allDayNames = [...new Set(datesInfo.map(d => d.dayName))];

        // Step 2: Fetch all holidays for the date range in ONE query
        const holidays = await prisma.libur.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate || startDate
                }
            }
        });

        // Libur bisa berlingkup seluruh madrasah, satu tingkat, atau kelas
        // tertentu — pengecekannya butuh konteks kelas, jadi indeksnya dievaluasi
        // per slot jadwal (lihat Step 8), bukan diringkas jadi set jam saja.
        const liburIndex = buildLiburIndex(holidays as unknown as Libur[]);

        // Step 3: Fetch ALL active schedules using Prisma
        const allSchedules = await prisma.jadwal_guru.findMany({
            where: {
                hari: { in: allDayNames },
                aktif: true
            }
        });

        // Step 4: Pre-fetch all class programs in ONE query
        const allKelas = [...new Set((allSchedules || []).map(s => s.kelas).filter(Boolean))];
        const kelasData = await prisma.master_kelas.findMany({
            where: { nama: { in: allKelas } },
            select: { nama: true, program: true, tingkat: true }
        });
        const classProgramMap = new Map<string, string>();
        // Tingkat dipakai untuk libur berlingkup tingkat (mis. hanya kelas XII).
        const classTingkatMap = new Map<string, string>();
        for (const k of (kelasData || [])) {
            classProgramMap.set(k.nama, k.program || 'Reguler');
            classTingkatMap.set(k.nama, String(k.tingkat ?? ''));
        }

        // Step 5: Pre-fetch all time ranges in ONE query
        const waktuData = await prisma.master_waktu.findMany({
            select: { program: true, hari: true, jam_ke: true, mulai: true, selesai: true }
        });
        const timeRangeMap = new Map<string, string>();
        for (const w of (waktuData || [])) {
            const jamNum = typeof w.jam_ke === 'string' ? parseInt(w.jam_ke) : w.jam_ke;
            const key = `${w.program}|${w.hari}|${jamNum}`;
            const formatTime = (t: any) => t ? String(t).substring(0, 5) : '';
            timeRangeMap.set(key, `${formatTime(w.mulai)} - ${formatTime(w.selesai)}`);
        }

        // Step 6: Pre-fetch all existing journals for the date range
        const existingJournals = await prisma.jurnal_guru.findMany({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate || startDate
                }
            },
            select: { kelas: true, jam_ke_id: true, tanggal: true }
        });

        const existingSet = new Set<string>();
        for (const j of existingJournals) {
            const datePart = String(j.tanggal).split('T')[0];
            const key = `${datePart}|${j.kelas}|${j.jam_ke_id}`;
            existingSet.add(key);
        }

        // Step 7: Kelompokkan jadwal per HARI, lalu per VERSI (berlaku_mulai).
        const scheduleByDay = new Map<string, Map<string, JadwalGuru[]>>();
        for (const sched of (allSchedules || [])) {
            const versi = sched.berlaku_mulai ? String(sched.berlaku_mulai).substring(0, 10) : '';
            if (!scheduleByDay.has(sched.hari)) scheduleByDay.set(sched.hari, new Map());
            const perVersi = scheduleByDay.get(sched.hari)!;
            if (!perVersi.has(versi)) perVersi.set(versi, []);
            perVersi.get(versi)!.push(sched as any);
        }

        // Step 8: Build all journal entries to insert
        const toInsert: any[] = [];
        for (const { dateStr, dayName } of datesInfo) {
            const perVersi = scheduleByDay.get(dayName);

            // Tidak ada jadwal sama sekali untuk hari ini (mis. Sabtu/Minggu)
            if (!perVersi || perVersi.size === 0) continue;

            // Versi yang berlaku pada tanggal ini = berlaku_mulai terbaru yang <= tanggal.
            let versiBerlaku: string | null = null;
            for (const versi of perVersi.keys()) {
                if (versi <= dateStr && (versiBerlaku === null || versi > versiBerlaku)) {
                    versiBerlaku = versi;
                }
            }

            if (versiBerlaku === null) {
                const jmlSlot = new Set(
                    [...perVersi.values()].flat().map(s => `${s.kelas}|${parseInt(String(s.jam_ke))}`)
                ).size;
                results.skipped_no_schedule += jmlSlot;
                results.debug.push(`${dateStr} (${dayName}): belum ada jadwal yang berlaku — ${jmlSlot} slot dilewati`);
                continue;
            }

            const rowsVersi = perVersi.get(versiBerlaku) || [];
            const seenSlot = new Set<string>();

            for (const bestSchedule of rowsVersi) {
                const schedKelas = bestSchedule.kelas;
                const schedJam = typeof bestSchedule.jam_ke === 'string'
                    ? parseInt(bestSchedule.jam_ke)
                    : (bestSchedule.jam_ke || 0);

                // Apply jamKe filter
                if (jamKeFilter && jamKeFilter.length > 0) {
                    if (!jamKeFilter.some(j => String(j) === String(schedJam))) continue;
                }

                const slotId = `${schedKelas}|${schedJam}`;
                if (seenSlot.has(slotId)) continue;
                seenSlot.add(slotId);

                // Check holiday
                if (liburIndex.isLibur(dateStr, schedJam, {
                    kelas: schedKelas,
                    tingkat: classTingkatMap.get(schedKelas),
                })) {
                    results.skipped_holiday++;
                    continue;
                }

                // Check existing — key = date|kelas|jam_ke
                const existsKey = `${dateStr}|${schedKelas}|${schedJam}`;
                if (existingSet.has(existsKey)) {
                    results.skipped_existing++;
                    continue;
                }

                // Get time range for jam_ke display
                const program = classProgramMap.get(schedKelas) || 'Reguler';
                const timeKey = `${program}|${dayName}|${schedJam}`;
                let jamKeString = String(bestSchedule.jam_ke || '');
                if (timeRangeMap.has(timeKey)) {
                    jamKeString = timeRangeMap.get(timeKey)!;
                }

                const newRecord = {
                    nip: bestSchedule.nip,
                    nama_guru: bestSchedule.nama_guru,
                    hari: dayName,
                    tanggal: dateStr,
                    jam_ke: jamKeString,
                    jam_ke_id: schedJam,
                    kelas: schedKelas,
                    mata_pelajaran: bestSchedule.mata_pelajaran || (bestSchedule as any).mapel || '',
                    kategori_kehadiran: 'Sesuai',
                    filled_by: 'ADMIN'
                };

                // Validate required fields
                if (!newRecord.nip || !newRecord.nama_guru || !newRecord.tanggal || !newRecord.jam_ke || !newRecord.kelas || !newRecord.mata_pelajaran) {
                    results.debug.push(`INVALID RECORD for ${schedKelas} jam ${schedJam}: Missing required fields. ${JSON.stringify(newRecord)}`);
                    continue;
                }

                toInsert.push(newRecord);

                // Mark as existing to prevent duplicate in same batch
                existingSet.add(existsKey);
            }
        }

        results.debug.push(`Total journals to insert: ${toInsert.length}`);

        // Step 9: Insert per-chunk using Prisma createMany
        const INSERT_CHUNK = 500;
        for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
            const chunk = toInsert.slice(i, i + INSERT_CHUNK);
            try {
                const res = await prisma.jurnal_guru.createMany({
                    data: chunk,
                    skipDuplicates: true
                });
                results.generated += res.count;
            } catch (insertError: any) {
                console.error('Batch insert error details:', insertError);
                results.errors.push(`Batch insert gagal (baris ${i + 1}-${i + chunk.length}): ${insertError.message}`);
                results.debug.push(`INSERT ERROR: ${insertError.message}`);
            }
        }

        return results;
    },

    async deleteJurnal(startDate: string, endDate: string, jamKeFilter: number[] = []) {
        const whereClause: any = {
            tanggal: {
                gte: startDate,
                lte: endDate
            }
        };

        if (jamKeFilter && jamKeFilter.length > 0) {
            whereClause.jam_ke_id = { in: jamKeFilter };
        }

        const res = await prisma.jurnal_guru.deleteMany({ where: whereClause });
        return res.count;
    }
};

export const jurnalService = JurnalService;
