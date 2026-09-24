-- Tambahkan hak akses UPDATE dan DELETE untuk tabel registrasi_sanggar

-- Mengizinkan admin atau authenticated user untuk update
CREATE POLICY "Allow update for authenticated" ON public.registrasi_sanggar FOR UPDATE TO authenticated USING (true);

-- Mengizinkan admin atau authenticated user untuk delete
CREATE POLICY "Allow delete for authenticated" ON public.registrasi_sanggar FOR DELETE TO authenticated USING (true);
