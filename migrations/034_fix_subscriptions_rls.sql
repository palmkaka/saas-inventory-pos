-- Migration: Add RLS policies for subscriptions
-- Description: เพิ่ม Policy ให้สามารถอ่านข้อมูล subscriptions ได้
-- Created: 2026-02-03

-- 1. Policy: Users เห็นข้อมูล Subscription ขององค์กรตัวเอง
CREATE POLICY "Users see their org subscription"
ON subscriptions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- 2. Policy: Super Admins เห็นข้อมูล Subscription ทั้งหมด
CREATE POLICY "Super Admins see all subscriptions"
ON subscriptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);
