-- Migration: Add is_anonymous column to survey_quipper_responses
-- Allows respondents to submit without recording their name/identity

ALTER TABLE survey_quipper_responses
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN survey_quipper_responses.is_anonymous IS 'If true, respondent_nama and respondent_nip are not recorded/displayed';

-- Backfill: set is_anonymous = false for existing rows
UPDATE survey_quipper_responses SET is_anonymous = false WHERE is_anonymous IS NULL;
