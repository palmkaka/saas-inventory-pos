-- Migration: Fix Delete Cascade for API Keys and Announcements
-- Description: แก้ปัญหาลบ User ไม่ได้เพราะติด Foreign Key constraints
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    -- 1. Fix api_keys: Drop existing constraint if exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'api_keys_created_by_fkey') THEN
        ALTER TABLE api_keys DROP CONSTRAINT api_keys_created_by_fkey;
    END IF;

    -- 2. Fix announcements: Drop existing constraint if exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'announcements_created_by_fkey') THEN
        ALTER TABLE announcements DROP CONSTRAINT announcements_created_by_fkey;
    END IF;
END $$;

-- 3. Add constraints back with ON DELETE SET NULL
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

ALTER TABLE announcements
    ADD CONSTRAINT announcements_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- 4. Verify other potential blockers (Optional, just to be safe)
-- If you have other tables referencing profiles without ON DELETE CASCADE/SET NULL, add them here.
