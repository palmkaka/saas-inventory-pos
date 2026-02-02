-- Migration: Fix Profiles RLS
-- Description: เพิ่ม Policy ให้ Users สามารถดู Profile ตัวเองได้ (แก้ปัญหา Login แล้วไม่เห็นข้อมูล)
-- Created: 2026-02-01

-- 1. Create function to get current user's organization_id (Safe from recursion)
CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT organization_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing policies to be safe
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view available profiles" ON profiles; -- Existing generic name?
DROP POLICY IF EXISTS "Users view same org profiles" ON profiles;

-- 3. Policy: Users can view their own profile (Critical for Login)
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 4. Policy: Users can view other profiles in the same organization (For User Management / POS)
CREATE POLICY "Users view same org profiles"
ON profiles FOR SELECT
USING (
  organization_id = get_current_user_org_id()
);

-- 5. Policy: Platform Admins can view all profiles
CREATE POLICY "Platform admins view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);
