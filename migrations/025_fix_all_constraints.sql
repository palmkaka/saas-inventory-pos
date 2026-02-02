-- Migration: Fix All User Deletion Constraints (Comprehensive)
-- Description: แก้ปัญหาลบ User ไม่ได้แบบถาวร โดยการแก้ Foreign Key ทั้งหมดที่เกี่ยวข้อง
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    -- 1. Fix 'profiles' table (Critical: This triggers cascade from auth.users)
    -- Check if constraint exists and drop it to recreate with CASCADE
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_id_fkey') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;

     -- 2. Fix 'api_keys' table
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'api_keys_created_by_fkey') THEN
        ALTER TABLE api_keys DROP CONSTRAINT api_keys_created_by_fkey;
    END IF;

    -- 3. Fix 'announcements' table
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'announcements_created_by_fkey') THEN
        ALTER TABLE announcements DROP CONSTRAINT announcements_created_by_fkey;
    END IF;

    -- 4. Fix 'approval_requests' (Just in case)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'approval_requests_requester_id_fkey') THEN
        ALTER TABLE approval_requests DROP CONSTRAINT approval_requests_requester_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'approval_requests_approver_id_fkey') THEN
        ALTER TABLE approval_requests DROP CONSTRAINT approval_requests_approver_id_fkey;
    END IF;

END $$;

-- Re-add constraints with correct ON DELETE behavior

-- 1. Profiles: Must CASCADE when auth.users is deleted
ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 2. API Keys: Set NULL (keep key but remove user ref)
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- 3. Announcements: Set NULL
ALTER TABLE announcements
    ADD CONSTRAINT announcements_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- 4. Approval Requests: Set NULL
ALTER TABLE approval_requests
    ADD CONSTRAINT approval_requests_requester_id_fkey
    FOREIGN KEY (requester_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

ALTER TABLE approval_requests
    ADD CONSTRAINT approval_requests_approver_id_fkey
    FOREIGN KEY (approver_id)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
