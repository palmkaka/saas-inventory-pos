-- Fix categories RLS: Add missing policies for categories table
-- Description: เพิ่ม Policy ให้ categories เนื่องจากถูก Enable RLS ไว้แต่ไม่มี Policy ทำให้เกิด 403 Forbidden

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users see their org categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their org categories" ON categories;

-- Policy: ดูหมวดหมู่ขององค์กรตัวเอง
CREATE POLICY "Users see their org categories"
ON categories FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (is_platform_admin = TRUE OR is_support_staff = TRUE)
  )
);

-- Policy: จัดการหมวดหมู่ (เพิ่ม/แก้ไข/ลบ) ได้เฉพาะคนในองค์กร
CREATE POLICY "Users can manage their org categories"
ON categories FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
