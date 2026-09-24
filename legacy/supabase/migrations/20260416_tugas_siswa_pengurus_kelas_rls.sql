-- Migration: Add RLS policy for PENGURUS_KELAS on tugas_siswa
-- Problem: Existing policies use role LIKE '%SISWA%' which does NOT match PENGURUS_KELAS.
-- Note: 'PENGURUS_KELAS' DOES contain 'SISWA' as substring, so the SISWA policy
-- technically matches it. However we create explicit policies for clarity and
-- because server-side code checks 'PENGURUS_KELAS' specifically.

-- Policy: PENGURUS_KELAS can view tugas_siswa
CREATE POLICY "PengurusKelas can view tugas_siswa"
    ON tugas_siswa FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND (role LIKE '%PENGURUS_KELAS%' OR role LIKE '%SISWA%')
        )
    );

-- Policy: PENGURUS_KELAS can insert tugas_siswa
CREATE POLICY "PengurusKelas can insert tugas_siswa"
    ON tugas_siswa FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%PENGURUS_KELAS%'
        )
    );

-- Policy: PENGURUS_KELAS can update own tugas_siswa records
CREATE POLICY "PengurusKelas can update own tugas_siswa"
    ON tugas_siswa FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%PENGURUS_KELAS%'
        )
    );

-- Policy: PENGURUS_KELAS can delete own tugas_siswa records
CREATE POLICY "PengurusKelas can delete own tugas_siswa"
    ON tugas_siswa FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role LIKE '%PENGURUS_KELAS%'
        )
    );
