-- Migration: Add INSERT policy for master_tahun_ajaran
-- Fix: RLS blocks INSERT because no INSERT policy exists

CREATE POLICY "Allow insert master_tahun_ajaran"
ON master_tahun_ajaran FOR INSERT WITH CHECK (true);