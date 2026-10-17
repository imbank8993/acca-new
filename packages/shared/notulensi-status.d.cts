export type NotulensiStatus = 'Belum' | 'Proses' | 'Selesai';
export function notulensiStatus(points: ReadonlyArray<{ status: NotulensiStatus }>): NotulensiStatus;
