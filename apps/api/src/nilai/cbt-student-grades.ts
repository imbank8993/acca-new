import { PrismaService } from '../prisma/prisma.service';

const scoreTypes = ['classical', 'irt_1pl', 'irt_2pl', 'irt_3pl'];
const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

// Keep the same publication/score-selection policy as CBT's publicStudentScores.
export function publishedCbtScore(attempt: any, exam: any) {
  const enabled = ['classical', ...String(exam.scoring_type || '').split(',').map(s => s.trim())];
  const requested = record(exam.metadata).student_score_type;
  const defaultType = [...scoreTypes].reverse().find(type => enabled.includes(type)) || 'classical';
  const type = scoreTypes.includes(requested) && enabled.includes(requested) ? requested : defaultType;
  const finite = (value: any): number | null => {
    if (typeof value !== 'number' && typeof value !== 'string' && typeof value?.toNumber !== 'function') return null;
    if (value == null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  };
  if (exam.show_results !== true || !['submitted', 'auto_submitted'].includes(attempt.status)) return null;
  const pending = attempt.needs_manual_grading === true || record(attempt.metadata).relative_scoring_pending === true;
  const score = pending ? null : type === 'classical' ? finite(attempt.total_score)
    : finite(record(attempt.detailed_scores)[type]) ?? (type === defaultType ? finite(attempt.score_irt) : null);
  return { score, type, status: pending ? 'pending' : score === null ? 'processing' : 'published' };
}

/** Read-through integration: no copied scores, no access to answers or answer keys. */
export async function loadCbtStudentGrades(prisma: PrismaService, nisn: string, memberships: any[], query: any = {}) {
  const accounts = await prisma.public_users.findMany({
    where: { nip: nisn }, select: { auth_id: true, cbt_auth_id: true },
  });
  const linkedIds = [...new Set(accounts.map(account => account.cbt_auth_id || account.auth_id).filter(Boolean))] as string[];
  const profiles = await prisma.cbt_profiles.findMany({
    where: linkedIds.length ? { id: { in: linkedIds } } : { identity_number: nisn },
    select: { id: true },
  });
  // Ambiguous identity must be corrected by an administrator, never guessed by name.
  if (profiles.length !== 1) return { items: [], linkage: profiles.length ? 'ambiguous' : 'unlinked' };
  const attempts = await prisma.cbt_exam_attempts.findMany({
    where: { user_id: profiles[0].id, status: { in: ['submitted', 'auto_submitted'] },
      cbt_exams: { is: { show_results: true } } },
    orderBy: [{ finished_at: 'desc' }, { id: 'asc' }],
    select: {
      id: true, organization_id: true, started_at: true, finished_at: true, status: true,
      total_score: true, score_irt: true, detailed_scores: true, metadata: true, needs_manual_grading: true,
      cbt_exams: { select: {
        organization_id: true, title: true, show_results: true, scoring_type: true, metadata: true,
        cbt_question_banks: { select: { organization_id: true, subject: true } },
        cbt_exam_question_sources: { select: {
          cbt_question_banks: { select: { organization_id: true, subject: true } },
        } },
        cbt_profiles: { select: { full_name: true } },
        cbt_pas_class_schedules: { select: {
          cbt_classes: { select: { name: true } },
          cbt_pas_periods: { select: { school_year: true, semester: true, organization_id: true } },
        } },
      } },
    },
  });
  const items = attempts.flatMap(attempt => {
    const exam = attempt.cbt_exams;
    if (!exam || !attempt.organization_id || attempt.organization_id !== exam.organization_id) return [];
    const published = publishedCbtScore(attempt, exam);
    if (!published) return [];
    const schedules = exam.cbt_pas_class_schedules.filter(schedule =>
      schedule.cbt_pas_periods?.organization_id === exam.organization_id);
    const period = schedules[0]?.cbt_pas_periods;
    // Ordinary CBT exams have no academic period. Derive it from the attempt's
    // start date in the school's timezone, never from today's active year.
    const date = attempt.started_at || attempt.finished_at;
    const localDate = date ? new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date) : [];
    const year = Number(localDate.find(part => part.type === 'year')?.value);
    const month = Number(localDate.find(part => part.type === 'month')?.value);
    const semester = period ? (/^(1|ganjil)$/i.test(period.semester) ? 1 : /^(2|genap)$/i.test(period.semester) ? 2 : 0)
      : month ? (month >= 7 ? 1 : 2) : 0;
    const tahunAjaran = period?.school_year || (year ? `${month >= 7 ? year : year - 1}/${month >= 7 ? year + 1 : year}` : 'Unknown');
    const member = memberships.find(row => row.tahun_ajaran === tahunAjaran &&
      (String(row.semester) === String(semester) || String(row.semester).toLowerCase() === (semester === 1 ? 'ganjil' : 'genap')));
    const kelas = member?.kelas || (schedules.length === 1 ? schedules[0].cbt_classes?.name : null) || '-';
    const banks = [exam.cbt_question_banks, ...exam.cbt_exam_question_sources.map(source => source.cbt_question_banks)];
    const subjects = [...new Set(banks.filter(bank => bank?.organization_id === exam.organization_id)
      .map(bank => bank?.subject?.trim()).filter((subject): subject is string => !!subject))];
    const mapel = subjects.join(' / ') || 'Belum ditentukan';
    if ((query.tahun_ajaran && query.tahun_ajaran !== 'all' && tahunAjaran !== query.tahun_ajaran) ||
      (query.semester && ![String(semester), semester === 1 ? 'ganjil' : 'genap'].includes(String(query.semester).toLowerCase())) ||
      (query.mapel && !mapel.toLowerCase().includes(String(query.mapel).toLowerCase())) ||
      (query.kelas && kelas !== query.kelas) || query.guruNip) return [];
    return [{
      id: `cbt:${attempt.id}`, sumber: 'cbt', nisn, nip: '', kelas, mapel, semester,
      tahun_ajaran: tahunAjaran, jenis: 'CBT', materi_tp: exam.title, tagihan: '', topik: null,
      nilai: published.score !== null && published.score !== undefined ? Number(Number(published.score).toFixed(2)) : null, score_type: published.type, grading_status: published.status,
      periode_dari_tanggal: !period, nama_guru: exam.cbt_profiles?.full_name || 'CBT',
      catatan: published.status === 'pending' ? 'Menunggu koreksi / finalisasi nilai CBT'
        : published.status === 'processing' ? 'Nilai CBT sedang diproses' : null,
      updated_at: attempt.finished_at?.toISOString() || null,
    }];
  });
  return { items, linkage: 'linked' };
}
