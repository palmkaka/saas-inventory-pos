-- Migration: Remove plan constraints
-- Description: ยกเลิก Constaint ที่จำกัดชื่อ Plan เพื่อรองรับชื่อ Plan ใหม่ๆ
-- Created: 2026-02-03

-- Drop the check constraints if they exist
DO $$ 
BEGIN 
    -- Try to drop constraint for 'plan'
    BEGIN
        ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
    EXCEPTION
        WHEN undefined_object THEN NULL;
    END;

    -- Try to drop constraint for 'status' (just in case we want flexibility here too, but mainly plan)
    BEGIN
        ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    EXCEPTION
        WHEN undefined_object THEN NULL;
    END;
END $$;
