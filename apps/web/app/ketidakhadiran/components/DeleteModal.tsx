"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { swalConfirmDelete } from "@/lib/swal-premium";
import { Button } from "@/components/ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  data: any;
  canDo: (resource: string, action: string) => any;
  allowedTypes?: {
    IZIN: boolean;
    SAKIT: boolean;
  };
}

export default function DeleteModal({ isOpen, onClose, onSuccess, data, canDo, allowedTypes }: DeleteModalProps) {
  const [scope, setScope] = useState<"ONE" | "ALL">("ONE");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) { setScope("ONE"); setSubmitting(false); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const handleSubmit = async () => {
    if (submitting) return;

    const jenis = String(data.jenis || "").toUpperCase();
    const jenisLower = jenis.toLowerCase();
    // Check permission: allowedTypes says allowed OR canDo check passes (server enforces again on DELETE)
    const canManageThis = allowedTypes?.[jenis as 'IZIN' | 'SAKIT'] || canDo(`ketidakhadiran.${jenisLower}`, "manage");
    if (!canManageThis) {
      await Swal.fire({ title: "Ditolak", text: `Anda tidak punya izin untuk menghapus data ${jenis}`, icon: "error" });
      return;
    }

    // Baris SAKIT hasil sinkronisasi UKS menautkan rekam medisnya; menghapus
    // absensi ikut menghapus rekam medis itu, jadi harus disebut lebih dulu.
    const adaRekamMedis = scope === 'ALL' ? jenis === 'SAKIT' : Boolean(data.rekam_medis_id);

    const konfirmasi = await swalConfirmDelete({
      title: 'Hapus data ketidakhadiran?',
      item: `${data.nama} — ${data.kelas}`,
      warning: [
        scope === 'ALL'
          ? 'Semua data dalam grup ini akan dihapus, bukan hanya siswa ini.'
          : '',
        adaRekamMedis
          ? `Rekam medis UKS yang tertaut ${scope === 'ALL' ? 'juga akan' : 'akan'} ikut terhapus.`
          : '',
      ].filter(Boolean).join(' '),
    });

    if (!konfirmasi) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/ketidakhadiran/${data.id}?scope=${scope}`, { method: "DELETE" });
      const result = await res.json();

      if (result.ok) {
        await Swal.fire({
          title: "Berhasil!",
          text: result.message || "Data berhasil dihapus",
          icon: "success",
          confirmButtonColor: "#3083FF",
          timer: 1400,
          showConfirmButton: false,
        });
        onSuccess();
        onClose();
      } else {
        await Swal.fire({ title: "Gagal", text: result.error || "Terjadi kesalahan", icon: "error", confirmButtonColor: "#3083FF" });
      }
    } catch (error: any) {
      console.error(error);
      await Swal.fire({ title: "Error", text: error?.message || "Terjadi kesalahan sistem", icon: "error", confirmButtonColor: "#3083FF" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title="Hapus Data Ketidakhadiran"
        subtitle="Konfirmasi sebelum menghapus data ketidakhadiran"
        icon="trash"
        onClose={onClose}
      />

      <ModalBody>
        <div className="kh-form">

          {/* Info Card */}
          <div className="kh-alert kh-alert--danger">
            <div className="kh-alert__icon">
              <i className="bi bi-trash3-fill"></i>
            </div>
            <div>
              <div className="kh-alert__title">Hapus data ketidakhadiran?</div>
              <div className="kh-alert__body">
                <strong>{data.nama}</strong> — {data.kelas} — {data.jenis} {data.status ? `(${data.status})` : ''}<br/>
                <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>{data.tgl_mulai} {data.tgl_selesai && data.tgl_selesai !== data.tgl_mulai ? `– ${data.tgl_selesai}` : ''}</span>
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="kh-field">
            <label className="kh-label">Pilih Data yang Dihapus</label>
            <div className="kh-seg">
              <button type="button" onClick={() => setScope("ONE")} className={`kh-seg__btn ${scope === "ONE" ? 'is-active' : ''}`}>
                <i className="bi bi-person" /> Siswa Ini
              </button>
              <button type="button" onClick={() => setScope("ALL")} className={`kh-seg__btn ${scope === "ALL" ? 'is-active' : ''}`}>
                <i className="bi bi-people" /> Semua (Grup)
              </button>
            </div>
            <p className="kh-hint">
              {scope === 'ALL'
                ? <><b>Semua</b> data dengan jenis, tanggal, dan keterangan yang sama akan dihapus.</>
                : <>Hanya <b>siswa ini</b> yang dihapus.</>}
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} disabled={submitting} leftIcon={<i className="bi bi-x-lg" />}>
          Batal
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleSubmit}
          isLoading={submitting}
          leftIcon={<i className="bi bi-trash3-fill" />}
        >
          Ya, Hapus
        </Button>
      </ModalFooter>
    </Modal>
  );
}
