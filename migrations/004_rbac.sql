-- Migration: Role-Based Access Control (RBAC)
-- Description: เพิ่มระบบจัดการสิทธิ์ตามบทบาท
-- Created: 2026-01-31

-- ============================================
-- 1. เพิ่มคอลัมน์ role ในตาราง profiles
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff' 
CHECK (role IN ('owner', 'manager', 'accountant', 'staff', 'hr'));

-- อัปเดต role ของ User ที่มีอยู่ให้เป็น owner (ถ้ายังไม่มี role)
UPDATE profiles SET role = 'owner' WHERE role IS NULL;

-- ============================================
-- 2. สร้างตาราง audit_logs (บันทึกการใช้งาน)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL, -- ชื่อตารางที่ถูกแก้ไข
  record_id TEXT, -- ID ของข้อมูลที่ถูกแก้ไข
  old_value JSONB, -- ค่าเดิม (สำหรับ update/delete)
  new_value JSONB, -- ค่าใหม่ (สำหรับ create/update)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับค้นหาเร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: เฉพาะ Owner และ Platform Admin เห็น Audit Logs
CREATE POLICY "Only owners and admins see audit logs"
ON audit_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);

-- ============================================
-- 3. สร้างตาราง approval_requests (คำขออนุมัติ)
-- ============================================
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL, -- 'delete_product', 'delete_order', 'adjust_stock'
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_approval_org ON approval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);

-- Enable RLS
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users เห็นคำขอในองค์กรตัวเอง
CREATE POLICY "Users see their org approval requests"
ON approval_requests FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- ============================================
-- 4. สร้าง Function ตรวจสอบสิทธิ์
-- ============================================

-- Function: ตรวจสอบว่า User มีสิทธิ์ดูข้อมูลทางการเงินหรือไม่
CREATE OR REPLACE FUNCTION can_view_financial_data()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'accountant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: ตรวจสอบว่า User มีสิทธิ์แก้ไขสินค้าหรือไม่
CREATE OR REPLACE FUNCTION can_edit_products()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: ตรวจสอบว่า User มีสิทธิ์ลบข้อมูลหรือไม่
CREATE OR REPLACE FUNCTION can_delete_records()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. อัปเดต RLS Policies สำหรับ Products
-- ============================================

-- ลบ Policy เดิม
DROP POLICY IF EXISTS "Users see their org products" ON products;

-- Policy ใหม่: ทุกคนเห็นสินค้า แต่ซ่อนราคาทุนสำหรับ Staff
CREATE POLICY "Users see their org products"
ON products FOR SELECT
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

-- Policy: เฉพาะ Owner/Manager แก้ไขสินค้าได้
CREATE POLICY "Only owners and managers can modify products"
ON products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

CREATE POLICY "Only owners and managers can update products"
ON products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

-- Policy: เฉพาะ Owner ลบสินค้าได้
CREATE POLICY "Only owners can delete products"
ON products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'owner'
  )
);

-- ============================================
-- 6. อัปเดต RLS Policies สำหรับ Orders
-- ============================================

DROP POLICY IF EXISTS "Users see their org orders" ON orders;

-- Policy: ทุกคนเห็น Orders
CREATE POLICY "Users see their org orders"
ON orders FOR SELECT
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

-- Policy: ทุกคน (ยกเว้น Accountant) สร้าง Order ได้
CREATE POLICY "Staff can create orders"
ON orders FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager', 'staff')
  )
);

-- Policy: เฉพาะ Owner ลบ Order ได้
CREATE POLICY "Only owners can delete orders"
ON orders FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'owner'
  )
);

-- ============================================
-- 7. อัปเดต RLS Policies สำหรับ Expenses
-- ============================================

DROP POLICY IF EXISTS "Users see their org expenses" ON expenses;

-- Policy: เฉพาะ Owner/Accountant เห็น Expenses
CREATE POLICY "Only owners and accountants see expenses"
ON expenses FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'accountant')
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);

-- Policy: เฉพาะ Owner/Accountant เพิ่ม Expenses ได้
CREATE POLICY "Only owners and accountants can add expenses"
ON expenses FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'accountant')
  )
);

-- Policy: เฉพาะ Owner ลบ Expenses ได้
CREATE POLICY "Only owners can delete expenses"
ON expenses FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'owner'
  )
);
