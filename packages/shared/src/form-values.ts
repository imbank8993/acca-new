export type FormValueField = Record<string, any>;
export const STRUCTURAL_FORM_TYPES = ['heading', 'paragraph', 'divider', 'page_break'];
export function formLabelKey(fields: FormValueField[], field: FormValueField): string {
    let occurrence = 0;
    for (const candidate of fields) { if (candidate.label === field.label) occurrence++; if (candidate.id === field.id) break; }
    return occurrence > 1 ? `${field.label} (${occurrence})` : field.label;
}
export function formAnswer(fields: FormValueField[], field: FormValueField, data: Record<string, any>): any {
    if (Object.prototype.hasOwnProperty.call(data, field.id)) return data[field.id];
    return data[formLabelKey(fields, field)];
}
export function formFieldVisible(field: FormValueField, data: Record<string, any>): boolean {
    if (!field.conditions?.length) return true;
    const evaluate = (c: FormValueField) => {
        const value = data[c.targetFieldId];
        switch (c.operator) {
            case 'equals': return Array.isArray(value) ? value.includes(c.value) : String(value ?? '') === String(c.value ?? '');
            case 'not_equals': return Array.isArray(value) ? !value.includes(c.value) : String(value ?? '') !== String(c.value ?? '');
            case 'contains': return String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
            case 'is_empty': return value == null || value === '' || (Array.isArray(value) && !value.length);
            case 'is_not_empty': return !(value == null || value === '' || (Array.isArray(value) && !value.length));
            default: return false;
        }
    };
    const satisfied = field.conditionLogic === 'or' ? field.conditions.some(evaluate) : field.conditions.every(evaluate);
    return field.conditionAction === 'hide' ? !satisfied : satisfied;
}
export function safeFormPattern(pattern: string): boolean {
    // A bounded subset avoids catastrophic backtracking in browser and server.
    if (pattern.length > 128 || /[()|]/.test(pattern) || /\\[1-9]/.test(pattern)) return false;
    const quantifiers = pattern.replace(/\\.|\[(?:\\.|[^\]\\])*\]/g, '').match(/[+*?]|\{\d+(?:,\d*)?\}/g) || [];
    if (quantifiers.length > 1) return false;
    if (quantifiers.length && (!pattern.startsWith('^') || !pattern.endsWith('$'))) return false;
    try { new RegExp(pattern); return true; } catch { return false; }
}
export function validateFormAnswers(fields: FormValueField[], raw: Record<string, any>, context: Record<string, any> = {}): { data: Record<string, any>; errors: string[] } {
    const errors: string[] = [];
    const data: Record<string, any> = Object.create(null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { data, errors: ['Jawaban harus berupa objek'] };
    const allowed = new Set<string>();
    for (const f of fields) if (!STRUCTURAL_FORM_TYPES.includes(f.type)) { allowed.add(f.id); allowed.add(formLabelKey(fields, f)); data[f.id] = formAnswer(fields, f, raw); }
    if (Object.keys(raw).some(k => raw[k] !== undefined && !allowed.has(k))) errors.push('Jawaban memuat field yang tidak dikenal');
    const visibilityData = { ...context, ...data };
    for (const f of fields) {
        if (STRUCTURAL_FORM_TYPES.includes(f.type)) continue;
        if (!formFieldVisible(f, visibilityData)) { delete data[f.id]; delete visibilityData[f.id]; continue; }
        const v = data[f.id], empty = v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
        const fail = (message: string) => errors.push(`${f.label}: ${message}`);
        if (empty) { if (f.required) fail('wajib diisi'); delete data[f.id]; continue; }
        if (['checkbox', 'select', 'radio'].includes(f.type)) {
            const answers = Array.isArray(v) ? v : [v];
            if ((f.type !== 'checkbox' && Array.isArray(v)) || (f.type === 'checkbox' && !Array.isArray(v)) || new Set(answers).size !== answers.length) { fail('tipe atau pilihan berulang tidak valid'); continue; }
            if (answers.some(a => typeof a !== 'string' || !(f.options || []).some((o: FormValueField) => o.value === a))) fail('pilihan tidak tersedia');
            if (f.type === 'checkbox' && (answers.length < (f.minSelected ?? 0) || answers.length > (f.maxSelected ?? 500))) fail('jumlah pilihan tidak sesuai');
            const taken = (f.excludeChosenFrom || []).flatMap((id: string) => Array.isArray(visibilityData[id]) ? visibilityData[id] : [visibilityData[id]]);
            if (answers.some(a => taken.includes(a))) fail('pilihan sudah digunakan pada pertanyaan lain');
        } else if (['number', 'slider', 'rating'].includes(f.type)) {
            const number = typeof v === 'number' ? v : typeof v === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()) ? Number(v) : NaN;
            const min = f.type === 'rating' ? 1 : f.min != null && f.min !== '' ? Number(f.min) : -Infinity;
            const max = f.type === 'rating' ? f.maxRating || 5 : f.max != null && f.max !== '' ? Number(f.max) : Infinity;
            if (!Number.isFinite(number) || number < min || number > max || (f.type === 'rating' && !Number.isInteger(number))) fail('angka di luar batas');
            else if (f.step && Number.isFinite(min) && Math.abs((number - min) / f.step - Math.round((number - min) / f.step)) > 0.000001) fail('angka tidak sesuai interval');
            else data[f.id] = number;
        } else if (f.type === 'file') {
            if (!Array.isArray(v) || !v.length || v.length > (f.multiple ? 10 : 1) || v.some(file => !file || typeof file !== 'object' || typeof file.url !== 'string' || typeof file.name !== 'string')) fail('unggah berkas yang valid');
        } else {
            if (typeof v !== 'string' || v.length > Math.min(f.maxLength ?? 10000, 10000) || v.length < (f.minLength ?? 0)) { fail('teks tidak sesuai batas'); continue; }
            if (f.pattern && (!safeFormPattern(f.pattern) || !new RegExp(f.pattern).test(v))) fail(f.patternMessage || 'format tidak sesuai');
            if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('email tidak valid');
            if (f.type === 'url') { try { if (!['http:', 'https:'].includes(new URL(v).protocol)) fail('URL tidak aman'); } catch { fail('URL tidak valid'); } }
            if (['date','datetime'].includes(f.type)) {
                const d = new Date(v.slice(0,10) + 'T00:00:00Z');
                const shape = f.type === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
                if (!shape.test(v) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== v.slice(0,10)) fail('tanggal tidak valid');
                if ((f.min && v < f.min) || (f.max && v > f.max)) fail('tanggal di luar batas');
            }
            if (f.type === 'time' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v) || (f.min && v < f.min) || (f.max && v > f.max))) fail('jam tidak valid');
        }
    }
    return { data, errors };
}
export function escapeFormHtml(value: any): string { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function formDisplayValue(value: any): string {
    if (Array.isArray(value)) return value.map(formDisplayValue).join(', ');
    if (value && typeof value === 'object') return typeof value.name === 'string' ? value.name : JSON.stringify(value);
    return String(value ?? '');
}
