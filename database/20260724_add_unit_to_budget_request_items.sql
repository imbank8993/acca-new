-- Menambahkan kolom unit (satuan) ke tabel budget_request_items
ALTER TABLE budget_request_items
ADD COLUMN unit VARCHAR(50);
