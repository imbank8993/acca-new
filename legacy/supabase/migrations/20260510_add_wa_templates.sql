-- Migration: Add WA message template columns with actual column names
-- Stores customizable message templates for each WhatsApp notification feature
-- Placeholders use actual table column names for easy editing

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES
    -- Piket main template
    ('wa_template_piket', 'Template Pesan Piket', 'Template pesan untuk notifikasi piket. Kolom: tanggal, hari, jam_ke, details, keterangan, nama_guru_piket, waktu', '📝 *Laporan Guru Piket*
📅 Tanggal: *{{tanggal}}*
🕐 Jam Ke: *{{jam_ke}}*
━━━━━━━━━━━━━━━━━

{{details}}

━━━━━━━━━━━━━━━━━
Keterangan: {{keterangan}}
Dilaporkan: {{nama_guru_piket}}
Input: {{waktu}} WITA

✨ Terima Kasih Bapak/Ibu Hebat MAN IC Gowa ✨', true, NOW(), NOW()),

    -- Piket row template (laporan_piket_detail columns)
    ('wa_details_row_template_piket', 'Template Baris Piket', 'Template baris untuk detail piket. Kolom: nama_kelas, nama_guru, status_kehadiran', '{{nama_kelas}} | {{nama_guru}} | {{status_kehadiran}}', true, NOW(), NOW()),

    -- Ketidakhadiran main template
    ('wa_template_ketidakhadiran', 'Template Pesan Ketidakhadiran', 'Template pesan untuk notifikasi ketidakhadiran. Kolom: tanggal, petugas_nama, jenis, details, total', '📋 *LAPORAN KETIDAKHADIRAN*
🗓️ {{tanggal}}
Petugas: {{petugas_nama}}
Jenis: {{jenis}}
─────────────────────

{{details}}
─────────────────────
📊 Total: {{total}} siswa
_Dikirim dari Sistem ACCA_', true, NOW(), NOW()),

    -- Ketidakhadiran row template (ketidakhadiran table columns)
    ('wa_details_row_template_ketidakhadiran', 'Template Baris Ketidakhadiran', 'Template baris untuk data ketidakhadiran. Kolom: no, nama, nisn, kelas, status, keterangan', '{{no}}. {{nama}} ({{kelas}}) - {{status}}', true, NOW(), NOW()),

    -- PTSP templates
    ('wa_template_ptsp', 'Template Pesan PTSP', 'Template pesan PTSP default. Kolom: service_type, short_code, catatan', '📋 *Notifikasi PTSP*
Layanan: {{service_type}}
Token: {{short_code}}
{{catatan}}', true, NOW(), NOW()),

    ('wa_template_ptsp_accepted', 'Template PTSP - Diterima', 'Pesan saat permohonan PTSP diterima. Kolom: service_type, short_code, tracking_url', '✅ *Permohonan Diterima*

Yth. Bapak/Ibu,

Permohonan layanan *{{service_type}}* telah kami terima dan sedang dalam antrian processing.

🔖 *Token:* {{short_code}}

📌 Cek status permohonan Anda di:
{{tracking_url}}

Mohon tunggu informasi selanjutnya. Terima kasih.
_Iklan MAN IC Gowa_', true, NOW(), NOW()),

    ('wa_template_ptsp_rejected', 'Template PTSP - Ditolak', 'Pesan saat permohonan PTSP ditolak. Kolom: service_type, short_code, catatan', '❌ *Permohonan Ditolak*

Yth. Bapak/Ibu,

Mohon maaf, permohonan layanan *{{service_type}}* dengan token:
🔖 *{{short_code}}*

...tidak dapat kami proses lebih lanjut.

{{catatan}}

📌 Jika ada pertanyaan, silakan hubungi kami langsung.
_Iklan MAN IC Gowa_', true, NOW(), NOW()),

    ('wa_template_ptsp_completed', 'Template PTSP - Selesai', 'Pesan saat permohonan PTSP selesai. Kolom: service_type, short_code, catatan', '🎉 *Permohonan Selesai!*

Yth. Bapak/Ibu,

Alhamdulillah, permohonan layanan *{{service_type}}* dengan token:
🔖 *{{short_code}}*

...telah selesai diproses.

{{catatan}}
Silakan ambil dokumen hasilnya di *Kantor MAN IC Gowa*.

Terima kasih atas kepercayaan Anda.
_Iklan MAN IC Gowa_', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    value = EXCLUDED.value;
