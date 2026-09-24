'use client';

/**
 * PilihJenisModal — pemilih jenis pengajuan (Izin/Sakit vs Dinas Luar).
 *
 * Sebelumnya ini Swal.fire dengan confirmButton/denyButton: tampilannya tidak
 * mengikuti tema halaman, dan dua tombol berdampingan tanpa keterangan membuat
 * pengguna harus menebak beda keduanya. Di sini tiap pilihan jadi satu baris
 * beropsi lebar dengan ikon dan penjelasan singkat, memakai kerangka <Modal>
 * yang sama dengan modal lain di app.
 */

import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export default function PilihJenisModal({
    isOpen,
    onClose,
    onPickIzin,
    onPickDinas,
}: {
    isOpen: boolean;
    onClose: () => void;
    onPickIzin: () => void;
    onPickDinas: () => void;
}) {
    return (
        <Modal
            open={isOpen}
            size="sm"
            variant="add"
            onClose={onClose}
            icon="plus-circle-fill"
            title="Pilih Jenis Pengajuan"
            subtitle="Pilih salah satu untuk melanjutkan ke formulir"
            labelledBy="ig-pilih-jenis-title"
        >
            <ModalBody>
                <div className="ig-pick">
                    <button
                        type="button"
                        className="ig-pick__opt ig-pick__opt--izin"
                        onClick={onPickIzin}
                    >
                        <span className="ig-pick__icon" aria-hidden="true">
                            <i className="bi bi-calendar-check" />
                        </span>
                        <span className="ig-pick__text">
                            <span className="ig-pick__title">Izin / Sakit</span>
                            <span className="ig-pick__desc">
                                Berhalangan hadir karena keperluan pribadi atau kondisi kesehatan.
                            </span>
                        </span>
                        <i className="bi bi-chevron-right ig-pick__arrow" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="ig-pick__opt ig-pick__opt--dinas"
                        onClick={onPickDinas}
                    >
                        <span className="ig-pick__icon" aria-hidden="true">
                            <i className="bi bi-briefcase" />
                        </span>
                        <span className="ig-pick__text">
                            <span className="ig-pick__title">Dinas Luar</span>
                            <span className="ig-pick__desc">
                                Tugas kedinasan di luar madrasah, wajib melampirkan surat tugas (PDF).
                            </span>
                        </span>
                        <i className="bi bi-chevron-right ig-pick__arrow" aria-hidden="true" />
                    </button>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="cancel" onClick={onClose} icon="cancel">
                    Batal
                </Button>
            </ModalFooter>
        </Modal>
    );
}
