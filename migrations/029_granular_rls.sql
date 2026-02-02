-- Migration: Granular RLS & Branch Isolation (Fixed & Secure)
-- Description: กำหนดสิทธิ์การเข้าถึงข้อมูลแบบละเอียด แยกตามตำแหน่งและสาขา (แก้ไข Logic และความปลอดภัย)
-- Created: 2026-02-01

-- ==========================================
-- 1. Helper Functions (ฟังก์ชันตัวช่วย - IMPORTANT)
-- ==========================================

-- 1.1 ดึง Role ของ User ปัจจุบัน (แก้ไขปัญหา column role does not exist)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.2 ดึง Branch ID ของ User ปัจจุบัน
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT branch_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.3 ดึง Organization ID ของ User ปัจจุบัน (เพื่อความปลอดภัยสูงสุด)
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT organization_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.4 เช็คว่าเป็นระดับ HQ (Manager/Accountant/HR ที่ไม่มี Branch หรือ Owner)
CREATE OR REPLACE FUNCTION is_hq_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
  -- Owner is always HQ level
  IF get_my_role() = 'owner' THEN RETURN TRUE; END IF;
  
  -- Manager/Accountant/HR without branch is HQ
  IF get_my_role() IN ('manager', 'accountant', 'hr') AND get_my_branch_id() IS NULL THEN RETURN TRUE; END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================
-- 2. Profiles (ข้อมูลพนักงาน)
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users view same org profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "View Own Profile" ON profiles;
DROP POLICY IF EXISTS "HQ Users View All Profiles" ON profiles;
DROP POLICY IF EXISTS "Branch Admin View Branch Profiles" ON profiles;

-- 2.1 ดูของตัวเองได้เสมอ
CREATE POLICY "View Own Profile" 
ON profiles FOR SELECT USING (id = auth.uid());

-- 2.2 HQ (Owner/GM/HR-HQ) ดูได้ทุกคนใน Organization
CREATE POLICY "HQ Users View All Profiles"
ON profiles FOR SELECT
USING (
  is_hq_or_owner() = TRUE 
  AND organization_id = get_my_org_id()
);

-- 2.3 Branch Manager / HR Branch ดูได้เฉพาะคนในสาขา
CREATE POLICY "Branch Admin View Branch Profiles"
ON profiles FOR SELECT
USING (
  get_my_role() IN ('manager', 'hr') 
  AND branch_id = get_my_branch_id()
  -- Note: branch_id logic ensures we only see profiles in same branch
);

-- ==========================================
-- 3. Products & Stock (สินค้าและสต็อก)
-- ==========================================

-- 3.1 Products (ตัวแม่แบบสินค้า) - ทุกคนใน Org ดูได้
DROP POLICY IF EXISTS "View Org Products" ON products;
CREATE POLICY "View Org Products"
ON products FOR SELECT
USING (
  organization_id = get_my_org_id()
);

-- 3.2 Product Stocks (สต็อกรายสาขา)
DROP POLICY IF EXISTS "Inventory View Branch + HQ Stock" ON product_stocks;
DROP POLICY IF EXISTS "Sales Manager View Branch Stock" ON product_stocks;
DROP POLICY IF EXISTS "HQ View All Stock" ON product_stocks;
DROP POLICY IF EXISTS "Inventory Update Own Stock" ON product_stocks;

-- Policy: Inventory เห็น Branch ตัวเอง + HQ (ที่อยู่ใน Org ตัวเองเท่านั้น)
CREATE POLICY "Inventory View Branch + HQ Stock"
ON product_stocks FOR SELECT
USING (
  get_my_role() = 'inventory' 
  AND (
    branch_id = get_my_branch_id() 
    OR 
    branch_id IN (SELECT id FROM branches WHERE is_main = TRUE AND organization_id = get_my_org_id())
  )
);

-- Policy: Sales / Manager เห็นเฉพาะ Branch ตัวเอง
CREATE POLICY "Sales Manager View Branch Stock"
ON product_stocks FOR SELECT
USING (
  get_my_role() IN ('sales', 'manager') 
  AND branch_id = get_my_branch_id()
);

-- Policy: HQ เห็นหมด (เฉพาะใน Org ตัวเอง)
CREATE POLICY "HQ View All Stock"
ON product_stocks FOR SELECT
USING (
  is_hq_or_owner() = TRUE
  AND branch_id IN (SELECT id FROM branches WHERE organization_id = get_my_org_id())
);

-- Policy: Inventory แก้ไขสต็อกได้เฉพาะ Branch ตัวเอง
CREATE POLICY "Inventory Update Own Stock"
ON product_stocks FOR UPDATE
USING (
  get_my_role() = 'inventory' 
  AND branch_id = get_my_branch_id()
);

-- ==========================================
-- 4. Orders (คำสั่งซื้อ)
-- ==========================================
DROP POLICY IF EXISTS "HQ View All Orders" ON orders;
DROP POLICY IF EXISTS "Branch Staff View Own Orders" ON orders;
DROP POLICY IF EXISTS "Sales Create Orders" ON orders;

-- 4.1 HQ เห็นหมด (เฉพาะ Org ตัวเอง)
CREATE POLICY "HQ View All Orders"
ON orders FOR SELECT
USING (
  is_hq_or_owner() = TRUE
  AND organization_id = get_my_org_id()
);

-- 4.2 Branch Manager / Sales / Inventory เห็นเฉพาะ Branch ตัวเอง
CREATE POLICY "Branch Staff View Own Orders"
ON orders FOR SELECT
USING (
  get_my_role() IN ('manager', 'sales', 'inventory')
  AND branch_id = get_my_branch_id()
);

-- 4.3 Sales สร้าง Order ได้ (เฉพาะ Branch ตัวเอง)
CREATE POLICY "Sales Create Orders"
ON orders FOR INSERT
WITH CHECK (
  get_my_role() = 'sales' 
  AND branch_id = get_my_branch_id()
  AND organization_id = get_my_org_id()
);

-- ==========================================
-- 5. Expenses / Incomes (บัญชี)
-- ==========================================
DROP POLICY IF EXISTS "HQ Accounts View All Expenses" ON expenses;
DROP POLICY IF EXISTS "Branch Accountant View Own Expenses" ON expenses;
DROP POLICY IF EXISTS "Branch Accountant Create Expenses" ON expenses;

-- 5.1 HQ Accountant / Owner เห็นหมด
CREATE POLICY "HQ Accounts View All Expenses"
ON expenses FOR SELECT
USING (
  is_hq_or_owner() = TRUE
  AND organization_id = get_my_org_id()
);

-- 5.2 Branch Accountant เห็นเฉพาะ Branch ตัวเอง
CREATE POLICY "Branch Accountant View Own Expenses"
ON expenses FOR SELECT
USING (
  get_my_role() = 'accountant' 
  AND branch_id = get_my_branch_id()
);

-- 5.3 Branch Accountant เพิ่มรายการได้
CREATE POLICY "Branch Accountant Create Expenses"
ON expenses FOR INSERT
WITH CHECK (
  get_my_role() = 'accountant'
  AND branch_id = get_my_branch_id()
  AND organization_id = get_my_org_id()
);

-- (Incomes)
DROP POLICY IF EXISTS "HQ Accounts View All Incomes" ON incomes;
DROP POLICY IF EXISTS "Branch Accountant View Own Incomes" ON incomes;
DROP POLICY IF EXISTS "Branch Accountant Create Incomes" ON incomes;

CREATE POLICY "HQ Accounts View All Incomes" 
ON incomes FOR SELECT 
USING (is_hq_or_owner() = TRUE AND organization_id = get_my_org_id());

CREATE POLICY "Branch Accountant View Own Incomes" 
ON incomes FOR SELECT 
USING (get_my_role() = 'accountant' AND branch_id = get_my_branch_id());

CREATE POLICY "Branch Accountant Create Incomes" 
ON incomes FOR INSERT 
WITH CHECK (get_my_role() = 'accountant' AND branch_id = get_my_branch_id() AND organization_id = get_my_org_id());
