-- Menambahkan kolom pelaporan digital ke tabel budget_requests
ALTER TABLE budget_requests
ADD COLUMN report_file_url VARCHAR(500),
ADD COLUMN receipt_file_url VARCHAR(500),
ADD COLUMN receipt_status VARCHAR(50) DEFAULT 'Belum Ada',
ADD COLUMN report_status VARCHAR(50) DEFAULT 'Belum Ada';
