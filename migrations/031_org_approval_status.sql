-- Migration: Add Organization Approval Status
-- Description: เพิ่มสถานะร้านค้า (pending, active, suspended, rejected) เพื่อทำระบบอนุมัติ

-- 1. Add status column with check constraint
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'active', 'suspended', 'rejected'));

-- 2. Update existing organizations to 'active' (Unblock everyone existing)
-- existing logic used 'is_blocked', we should migrate that too
UPDATE organizations 
SET status = CASE 
    WHEN is_blocked = TRUE THEN 'suspended'
    ELSE 'active'
END;

-- 3. Update 'is_blocked' column comment to say it's deprecated or sync it
COMMENT ON COLUMN organizations.is_blocked IS 'Deprecated: use status instead';
