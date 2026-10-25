import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiUser, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await getApiUser(request);
    if (!user) return unauthorizedResponse();

    const roles = (user.roles || []).map(r => String(r).toUpperCase());
    const isSiswa = roles.includes('SISWA');
    const isAdmin = user.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const isGuru = roles.includes('GURU') || isAdmin;

    const now = new Date();

    try {
        // ── 1. SISWA FLOW ────────────────────────────────────────────────────────
        if (isSiswa) {
            const authId = user.authId;
            const nip = user.nip;
            const nisn = user.nisn || user.nip;

            // Cari CBT profile ID berdasarkan authId atau identity_number (NISN/NIP)
            const profile = await prisma.cbt_profiles.findFirst({
                where: {
                    OR: [
                        ...(authId ? [{ id: authId }] : []),
                        ...(nisn ? [{ identity_number: nisn }] : []),
                        ...(nip ? [{ identity_number: nip }] : [])
                    ]
                },
                select: { id: true, full_name: true }
            });

            const candidateUserIds = Array.from(new Set([authId, profile?.id].filter(Boolean) as string[]));

            // Kumpulkan kelas reguler & tambahan dari CBT
            const classIds = new Set<string>();
            const addClassIds = new Set<string>();

            if (candidateUserIds.length > 0) {
                const [regular, additional] = await Promise.all([
                    prisma.cbt_class_members.findMany({
                        where: { user_id: { in: candidateUserIds } },
                        select: { class_id: true }
                    }),
                    prisma.cbt_additional_class_members.findMany({
                        where: { user_id: { in: candidateUserIds } },
                        select: { class_id: true }
                    })
                ]);

                regular.forEach(r => { if (r.class_id) classIds.add(r.class_id); });
                additional.forEach(a => { if (a.class_id) addClassIds.add(a.class_id); });
            }

            // Integrasi kelas ACCA siswa jika profil CBT belum lengkap
            if (nisn) {
                const accaSiswaKelas = await prisma.siswa_kelas.findMany({
                    where: { nisn: nisn, aktif: true },
                    select: { kelas: true }
                });

                const accaKelasNames = accaSiswaKelas.map(sk => sk.kelas).filter(Boolean);
                if (accaKelasNames.length > 0) {
                    const matchingCbtClasses = await prisma.cbt_classes.findMany({
                        where: { name: { in: accaKelasNames } },
                        select: { id: true }
                    });
                    matchingCbtClasses.forEach(c => classIds.add(c.id));
                }
            }

            // Ujian penunjukan langsung (cbt_exam_participants)
            const directParticipantExamIds = new Set<string>();
            if (candidateUserIds.length > 0) {
                const directParts = await prisma.cbt_exam_participants.findMany({
                    where: { user_id: { in: candidateUserIds } },
                    select: { exam_id: true }
                });
                directParts.forEach(p => { if (p.exam_id) directParticipantExamIds.add(p.exam_id); });
            }

            // Ujian berdasarkan target kelas (cbt_exam_targets)
            const targetConditions: any[] = [];
            if (classIds.size > 0) targetConditions.push({ class_id: { in: Array.from(classIds) } });
            if (addClassIds.size > 0) targetConditions.push({ additional_class_id: { in: Array.from(addClassIds) } });

            const classExamIds = new Set<string>();
            if (targetConditions.length > 0) {
                const targets = await prisma.cbt_exam_targets.findMany({
                    where: { OR: targetConditions },
                    select: { exam_id: true }
                });
                targets.forEach(t => { if (t.exam_id) classExamIds.add(t.exam_id); });
            }

            const assignedExamIds = Array.from(new Set([...directParticipantExamIds, ...classExamIds]));

            if (assignedExamIds.length === 0) {
                return NextResponse.json({
                    ok: true,
                    role: 'SISWA',
                    counts: { active: 0, upcoming: 0, completed: 0, total: 0 },
                    hasActiveExam: false,
                    exams: { active: [], upcoming: [], completed: [], all: [] }
                });
            }

            const exams = await prisma.cbt_exams.findMany({
                where: {
                    is_published: true,
                    id: { in: assignedExamIds }
                },
                include: {
                    cbt_subjects: { select: { id: true, name: true } },
                    cbt_profiles: { select: { id: true, full_name: true } },
                    cbt_exam_attempts: {
                        where: { user_id: { in: candidateUserIds } },
                        select: {
                            id: true,
                            status: true,
                            started_at: true,
                            finished_at: true
                        }
                    }
                },
                orderBy: { start_time: 'asc' }
            });

            const active: any[] = [];
            const upcoming: any[] = [];
            const completed: any[] = [];

            for (const exam of exams) {
                const attempt = exam.cbt_exam_attempts[0] || null;
                const isAttemptCompleted = attempt && (attempt.status === 'submitted' || attempt.status === 'auto_submitted');
                const isAttemptInProgress = attempt && attempt.status === 'in_progress';

                const startTime = exam.start_time ? new Date(exam.start_time) : null;
                const endTime = exam.end_time ? new Date(exam.end_time) : null;

                const isDirectlyDesignated = directParticipantExamIds.has(exam.id);

                const formatted = {
                    id: exam.id,
                    title: exam.title,
                    description: exam.description,
                    subject: exam.cbt_subjects?.name || null,
                    exam_type: exam.exam_type || 'daily',
                    duration_minutes: exam.duration_minutes,
                    start_time: exam.start_time,
                    end_time: exam.end_time,
                    status: exam.status,
                    creator_name: exam.cbt_profiles?.full_name || 'Guru / Proktor',
                    isDirectlyDesignated,
                    attempt: attempt ? {
                        id: attempt.id,
                        status: attempt.status,
                        started_at: attempt.started_at,
                        finished_at: attempt.finished_at
                    } : null,
                    isCompleted: isAttemptCompleted,
                    isInProgress: isAttemptInProgress,
                    cbtUrl: `/api/sso/cbt`
                };

                if (isAttemptCompleted || (endTime && endTime < now) || exam.status === 'completed' || exam.status === 'finished') {
                    completed.push({ ...formatted, category: 'completed' });
                } else if (startTime && startTime > now) {
                    upcoming.push({ ...formatted, category: 'upcoming' });
                } else {
                    active.push({ ...formatted, category: 'active' });
                }
            }

            return NextResponse.json({
                ok: true,
                role: 'SISWA',
                counts: {
                    active: active.length,
                    upcoming: upcoming.length,
                    completed: completed.length,
                    total: exams.length
                },
                hasActiveExam: active.length > 0,
                exams: {
                    active,
                    upcoming,
                    completed,
                    all: [...active, ...upcoming, ...completed]
                }
            });
        }

        // ── 2. GURU & ADMIN FLOW ─────────────────────────────────────────────────
        if (isGuru) {
            const authId = user.authId;
            const nip = user.nip;

            const profile = await prisma.cbt_profiles.findFirst({
                where: {
                    OR: [
                        ...(authId ? [{ id: authId }] : []),
                        ...(nip ? [{ identity_number: nip }] : [])
                    ]
                },
                select: { id: true, full_name: true }
            });

            const candidateCreatorIds = Array.from(new Set([authId, profile?.id].filter(Boolean) as string[]));

            // Cek apakah user memiliki peran pemantauan: Admin, Proktor, atau Pengawas di CBT maupun ACCA
            let isCbtMonitorStaff = isAdmin;
            if (!isCbtMonitorStaff && candidateCreatorIds.length > 0) {
                try {
                    const memberRoles = await prisma.cbt_member_roles.findMany({
                        where: {
                            cbt_organization_members: {
                                user_id: { in: candidateCreatorIds },
                                is_active: true
                            }
                        },
                        select: {
                            cbt_roles: {
                                select: { name: true }
                            }
                        }
                    });

                    const cbtRoleNames = memberRoles
                        .map(mr => mr.cbt_roles?.name?.toUpperCase())
                        .filter(Boolean);

                    if (
                        cbtRoleNames.includes('ADMIN') ||
                        cbtRoleNames.includes('PROKTOR') ||
                        cbtRoleNames.includes('PENGAWAS') ||
                        roles.includes('PROKTOR') ||
                        roles.includes('PENGAWAS')
                    ) {
                        isCbtMonitorStaff = true;
                    }
                } catch (e) {
                    console.error('[cbt-exams] Gagal membaca peran CBT staf:', e);
                }
            }

            // Opsi Lanjutan:
            // Admin & Pengawas/Proktor dapat melihat seluruh ujian.
            // Guru biasa dapat melihat:
            // 1. Ujian buatannya sendiri (termasuk draft/terjadwal)
            // 2. Seluruh ujian sekolah yang sudah dipublikasikan (is_published: true)
            const whereClause: any = isCbtMonitorStaff
                ? {}
                : {
                    OR: [
                        ...(candidateCreatorIds.length > 0 ? [{ created_by: { in: candidateCreatorIds } }] : []),
                        { is_published: true }
                    ]
                };

            const exams = await prisma.cbt_exams.findMany({
                where: whereClause,
                include: {
                    cbt_subjects: { select: { id: true, name: true } },
                    cbt_profiles: { select: { id: true, full_name: true } },
                    cbt_exam_targets: {
                        include: {
                            cbt_classes: { select: { name: true } }
                        }
                    },
                    cbt_exam_participants: { select: { id: true } },
                    cbt_exam_attempts: {
                        select: {
                            id: true,
                            status: true
                        }
                    }
                },
                orderBy: { start_time: 'asc' }
            });

            const active: any[] = [];
            const upcoming: any[] = [];
            const completed: any[] = [];

            for (const exam of exams) {
                const startTime = exam.start_time ? new Date(exam.start_time) : null;
                const endTime = exam.end_time ? new Date(exam.end_time) : null;

                const totalAttempts = exam.cbt_exam_attempts.length;
                const finishedAttempts = exam.cbt_exam_attempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted').length;
                const activeAttempts = exam.cbt_exam_attempts.filter(a => a.status === 'in_progress').length;

                const targetClasses = exam.cbt_exam_targets
                    .map(t => t.cbt_classes?.name)
                    .filter(Boolean);

                const isCreator = Boolean(exam.created_by && candidateCreatorIds.includes(exam.created_by));
                const canMonitor = Boolean(isCbtMonitorStaff || isCreator);

                const formatted = {
                    id: exam.id,
                    title: exam.title,
                    description: exam.description,
                    subject: exam.cbt_subjects?.name || null,
                    exam_type: exam.exam_type || 'daily',
                    duration_minutes: exam.duration_minutes,
                    start_time: exam.start_time,
                    end_time: exam.end_time,
                    status: exam.status,
                    is_published: exam.is_published,
                    creator_name: exam.cbt_profiles?.full_name || 'Guru',
                    isCreator,
                    canMonitor,
                    target_classes: targetClasses,
                    participants_count: exam.cbt_exam_participants.length,
                    stats: {
                        totalAttempts,
                        finishedAttempts,
                        activeAttempts
                    },
                    cbtUrl: `/api/sso/cbt`
                };

                // ASAS/ASAT/AM tetap berstatus scheduled setelah diaktifkan
                // melalui is_published; jendela waktunya menentukan kapan aktif.
                if (exam.status === 'completed' || exam.status === 'finished' || (endTime && endTime < now)) {
                    completed.push({ ...formatted, category: 'completed' });
                } else if (startTime && startTime > now) {
                    upcoming.push({ ...formatted, category: 'upcoming' });
                } else if ((exam.status === 'active' || exam.status === 'scheduled') && exam.is_published) {
                    active.push({ ...formatted, category: 'active' });
                } else {
                    upcoming.push({ ...formatted, category: 'upcoming' });
                }
            }

            return NextResponse.json({
                ok: true,
                role: isAdmin ? 'ADMIN' : 'GURU',
                counts: {
                    active: active.length,
                    upcoming: upcoming.length,
                    completed: completed.length,
                    total: exams.length
                },
                hasActiveExam: active.length > 0,
                exams: {
                    active,
                    upcoming,
                    completed,
                    all: [...active, ...upcoming, ...completed]
                }
            });
        }

        return NextResponse.json({
            ok: true,
            role: 'OTHER',
            counts: { active: 0, upcoming: 0, completed: 0, total: 0 },
            hasActiveExam: false,
            exams: { active: [], upcoming: [], completed: [], all: [] }
        });
    } catch (error: any) {
        console.error('[cbt-exams] Error loading dashboard exams:', error);
        return NextResponse.json({
            ok: false,
            error: error?.message || 'Gagal memuat informasi ujian'
        }, { status: 500 });
    }
}
