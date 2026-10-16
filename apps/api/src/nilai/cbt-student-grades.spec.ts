import { loadCbtStudentGrades, publishedCbtScore } from './cbt-student-grades';
import { NilaiService } from './nilai.service';

const exam = {
  organization_id: 'school', title: 'PAS Matematika', show_results: true, scoring_type: 'classical', metadata: {},
  cbt_subjects: { name: 'Matematika' }, cbt_profiles: { full_name: 'Guru' }, cbt_pas_class_schedules: [],
  cbt_question_banks: { organization_id: 'school', subject: 'Matematika' }, cbt_exam_question_sources: [],
};
const attempt = {
  id: 'attempt', organization_id: 'school', status: 'submitted', total_score: 82,
  started_at: new Date('2026-07-01T00:00:00Z'), finished_at: new Date('2026-07-01T01:00:00Z'),
  score_irt: null, detailed_scores: {}, metadata: {}, needs_manual_grading: false, cbt_exams: exam,
};
function fixture(rows: any[] = [attempt]) {
  const prisma: any = {
    public_users: { findMany: jest.fn().mockResolvedValue([{ auth_id: 'profile', cbt_auth_id: null }]), findFirst: jest.fn().mockResolvedValue(null) },
    cbt_profiles: { findMany: jest.fn().mockResolvedValue([{ id: 'profile' }]) },
    cbt_exam_attempts: { findMany: jest.fn().mockResolvedValue(rows) },
    nilai_data: { findMany: jest.fn().mockResolvedValue([{ id: 1, nip: '', nisn: '001', tahun_ajaran: '2026/2027', semester: 1, mapel: 'Matematika', nilai: 90 }]) },
    master_siswa: { findUnique: jest.fn().mockResolvedValue({ nisn: '001', nama_lengkap: 'Siswa' }) },
    siswa_kelas: { findMany: jest.fn().mockResolvedValue([{ kelas: 'X A', tahun_ajaran: '2026/2027', semester: 'Ganjil' }]) },
    master_kelas: { findMany: jest.fn().mockResolvedValue([{ nama: 'X A' }]) },
    nilai_bobot: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new NilaiService(prisma) };
}

describe('Published CBT scores', () => {
  it.each(['in_progress', 'abandoned', 'cancelled'])('never reveals a %s attempt', status => {
    expect(publishedCbtScore({ ...attempt, status }, exam)).toBeNull();
  });
  it('never reveals unpublished scores', () => {
    expect(publishedCbtScore(attempt, { ...exam, show_results: false })).toBeNull();
  });
  it.each([{ needs_manual_grading: true }, { metadata: { relative_scoring_pending: true } }])('redacts scores awaiting finalization: %j', pending => {
    expect(publishedCbtScore({ ...attempt, ...pending }, exam)).toMatchObject({ score: null, status: 'pending' });
  });
  it.each([null, '', true, false, NaN, Infinity, -1, 101])('does not coerce an invalid score to a grade: %s', total_score => {
    expect(publishedCbtScore({ ...attempt, total_score }, exam)?.score).toBeNull();
  });
  it('keeps zero as a real score', () => {
    expect(publishedCbtScore({ ...attempt, total_score: 0 }, exam)?.score).toBe(0);
  });
  it('honors the selected IRT model and does not expose the classical fallback', () => {
    const irt = { ...exam, scoring_type: 'classical,irt_1pl,irt_3pl', metadata: { student_score_type: 'irt_1pl' } };
    expect(publishedCbtScore({ ...attempt, score_irt: 99 }, irt)?.score).toBeNull();
    expect(publishedCbtScore({ ...attempt, detailed_scores: { irt_1pl: 72 } }, irt)).toMatchObject({ score: 72, type: 'irt_1pl' });
  });
  it('uses the primary IRT score only for its default model', () => {
    expect(publishedCbtScore({ ...attempt, score_irt: 70 }, { ...exam, scoring_type: 'irt_3pl' })).toMatchObject({ score: 70, type: 'irt_3pl' });
  });
});

describe('CBT student integration', () => {
  it('prefers the explicit CBT account over the old auth account', async () => {
    const { prisma } = fixture();
    prisma.public_users.findMany.mockResolvedValue([{ cbt_auth_id: 'linked-cbt', auth_id: 'old' }]);
    await loadCbtStudentGrades(prisma, '001', []);
    expect(prisma.cbt_profiles.findMany).toHaveBeenCalledWith({ where: { id: { in: ['linked-cbt'] } }, select: { id: true } });
  });
  it('falls back to exact protected NISN when there is no linked account', async () => {
    const { prisma } = fixture();
    prisma.public_users.findMany.mockResolvedValue([]);
    await loadCbtStudentGrades(prisma, '001', []);
    expect(prisma.cbt_profiles.findMany).toHaveBeenCalledWith({ where: { identity_number: '001' }, select: { id: true } });
  });
  it.each([{ profiles: [] }, { profiles: [{ id: 'one' }, { id: 'two' }] }])('does not guess a missing or ambiguous profile: %j', async ({ profiles }) => {
    const { prisma } = fixture();
    prisma.cbt_profiles.findMany.mockResolvedValue(profiles);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items).toEqual([]);
    expect(prisma.cbt_exam_attempts.findMany).not.toHaveBeenCalled();
  });
  it('scopes attempts to the resolved student and reads only released completed results', async () => {
    const { prisma } = fixture();
    const result = await loadCbtStudentGrades(prisma, '001', []);
    expect(prisma.cbt_exam_attempts.findMany.mock.calls[0][0].where).toEqual({ user_id: 'profile', status: { in: ['submitted', 'auto_submitted'] }, cbt_exams: { is: { show_results: true } } });
    expect(result.items[0]).toMatchObject({ id: 'cbt:attempt', sumber: 'cbt', nilai: 82, semester: 1, tahun_ajaran: '2026/2027' });
    expect(result.items[0]).not.toHaveProperty('metadata');
    expect(result.items[0]).not.toHaveProperty('detailed_scores');
  });
  it('rejects mismatched organization and hidden results defensively', async () => {
    const { prisma } = fixture([{ ...attempt, organization_id: 'other' }, { ...attempt, cbt_exams: { ...exam, show_results: false } }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items).toEqual([]);
  });
  it('reads current corrections without storing duplicate copies', async () => {
    const { prisma } = fixture();
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0].nilai).toBe(82);
    prisma.cbt_exam_attempts.findMany.mockResolvedValue([{ ...attempt, total_score: 92 }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0].nilai).toBe(92);
  });
  it('uses the bank subject instead of the exam subject', async () => {
    const { prisma } = fixture([{ ...attempt, cbt_exams: { ...exam,
      cbt_subjects: { name: 'Mapel ujian berbeda' },
      cbt_question_banks: { organization_id: 'school', subject: ' Biologi ' },
    } }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0].mapel).toBe('Biologi');
    expect((await loadCbtStudentGrades(prisma, '001', [], { mapel: 'biologi' })).items).toHaveLength(1);
    expect((await loadCbtStudentGrades(prisma, '001', [], { mapel: 'Mapel ujian berbeda' })).items).toHaveLength(0);
  });
  it('includes and deduplicates subjects from multiple selected banks', async () => {
    const { prisma } = fixture([{ ...attempt, cbt_exams: { ...exam, cbt_exam_question_sources: [
      { cbt_question_banks: { organization_id: 'school', subject: 'Matematika' } },
      { cbt_question_banks: { organization_id: 'school', subject: 'Biologi' } },
      { cbt_question_banks: { organization_id: 'other', subject: 'Private subject' } },
    ] } }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0].mapel).toBe('Matematika / Biologi');
  });
  it('does not invent a subject when the bank is missing or its subject is empty', async () => {
    const { prisma } = fixture([{ ...attempt, cbt_exams: { ...exam, cbt_question_banks: null } }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0].mapel).toBe('Belum ditentukan');
  });
  it('uses school local start time at a semester/year boundary', async () => {
    const { prisma } = fixture([{ ...attempt, started_at: new Date('2026-06-30T17:00:00Z') }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0]).toMatchObject({ semester: 1, tahun_ajaran: '2026/2027' });
  });
  it('prefers the explicitly scheduled PAS period over the attempt date', async () => {
    const { prisma } = fixture([{ ...attempt, cbt_exams: { ...exam, cbt_pas_class_schedules: [{
      cbt_classes: { name: 'X A' }, cbt_pas_periods: { school_year: '2025/2026', semester: 'Genap', organization_id: 'school' },
    }] } }]);
    expect((await loadCbtStudentGrades(prisma, '001', [])).items[0]).toMatchObject({ semester: 2, tahun_ajaran: '2025/2026', kelas: 'X A', periode_dari_tanggal: false });
  });
  it.each([{ semester: 'Genap' }, { tahun_ajaran: '2025/2026' }, { mapel: 'Biologi' }, { guruNip: 'unrelated' }, { kelas: 'X B' }])('respects grade filters %j', async query => {
    const { prisma } = fixture();
    expect((await loadCbtStudentGrades(prisma, '001', [], query)).items).toEqual([]);
  });
  it('checks authorization before looking up CBT identities', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(service, 'checkSiswaAccess').mockResolvedValue(false);
    await expect(service.getSiswaNilai({ id: 1 }, '001', {})).rejects.toThrow('Akses ditolak');
    expect(prisma.public_users.findMany).not.toHaveBeenCalled();
    expect(prisma.cbt_exam_attempts.findMany).not.toHaveBeenCalled();
  });
  it('never treats a mutable login name as the student NISN', async () => {
    const { service } = fixture();
    expect(await service.checkSiswaAccess({ id: 1, roles: ['SISWA'], nip: null, username: '001' }, '001')).toBe(false);
    expect(await service.checkSiswaAccess({ id: 1, roles: ['SISWA'], nip: '001', username: 'other' }, '001')).toBe(true);
  });
  it.each(['all', 'guru', 'cbt'])('returns grades filtered by source %s', async sumber => {
    const { service } = fixture();
    jest.spyOn(service, 'checkSiswaAccess').mockResolvedValue(true);
    const result = await service.getSiswaNilai({ id: 1 }, '001', { sumber });
    expect(result.data.all.map((item: any) => item.sumber)).toEqual(sumber === 'all' ? ['guru', 'cbt'] : [sumber]);
    expect(result.data.grouped['2026/2027']['1']).toEqual(result.data.all);
  });
  it('rejects unknown source filters', async () => {
    const { service } = fixture();
    jest.spyOn(service, 'checkSiswaAccess').mockResolvedValue(true);
    await expect(service.getSiswaNilai({ id: 1 }, '001', { sumber: 'invalid' })).rejects.toThrow('Sumber nilai');
  });
  it('excludes elective memberships stored in siswa_kelas using the master program category', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(service, 'checkSiswaAccess').mockResolvedValue(true);
    const membership = { tahun_ajaran: '2026/2027', semester: 'Ganjil' };
    prisma.siswa_kelas.findMany.mockResolvedValue([
      { ...membership, kelas: 'XI Biologi 1' },
      { ...membership, kelas: 'XI Matematika Lanjut 3' },
      { ...membership, kelas: 'XI D' },
    ]);
    prisma.master_kelas.findMany.mockResolvedValue([{ nama: 'XI D' }]);
    const result = await service.getSiswaNilai({ id: 1 }, '001', {});
    expect(result.data.kelas).toEqual([{ ...membership, kelas: 'XI D' }]);
    expect(prisma.master_kelas.findMany.mock.calls[0][0].where.program).toEqual({ equals: 'Reguler', mode: 'insensitive' });
    expect(result.data.all.find((row: any) => row.sumber === 'cbt').kelas).toBe('XI D');
  });
  it('leaves the regular class empty when only elective memberships exist', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(service, 'checkSiswaAccess').mockResolvedValue(true);
    prisma.siswa_kelas.findMany.mockResolvedValue([{ kelas: 'XI Biologi 1', tahun_ajaran: '2026/2027', semester: 'Ganjil' }]);
    prisma.master_kelas.findMany.mockResolvedValue([]);
    expect((await service.getSiswaNilai({ id: 1 }, '001', {})).data.kelas).toEqual([]);
  });
});
