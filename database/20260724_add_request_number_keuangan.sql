-- Menambahkan kolom request_number ke tabel budget_requests
ALTER TABLE budget_requests
ADD COLUMN request_number VARCHAR(50);

-- Update data lama agar tidak null (menggunakan ID sementara)
UPDATE budget_requests
SET request_number = 'REQ-OLD-' || substr(id::text, 1, 8)
WHERE request_number IS NULL;

-- Jadikan unique
ALTER TABLE budget_requests
ADD CONSTRAINT budget_requests_request_number_key UNIQUE (request_number);
