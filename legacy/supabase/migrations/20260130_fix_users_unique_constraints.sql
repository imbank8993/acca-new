-- Migration: Ensure username is unique for bulk upsert functionality
-- This fixes the error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- 1. Try to make username unique. 
-- In case there are duplicates, we might want to resolve them manually, 
-- but usually usernames in this system should be unique.

ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Also add uniqueness to NIP if it doesn't exist, as it's often used as an identifier
ALTER TABLE users ADD CONSTRAINT users_nip_key UNIQUE (nip);
