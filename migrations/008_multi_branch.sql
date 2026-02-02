-- Migration: Multi-Branch Support
-- Description: เพิ่มระบบสาขา แยกสต็อกตามสาขา และปรับปรุงข้อมูลเดิม
-- Created: 2026-01-31

-- ============================================
-- 1. สร้างตาราง branches (สาขา)
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- รหัสสาขา เช่น HQ, BKK01
  address TEXT,
  phone TEXT,
  is_main BOOLEAN DEFAULT FALSE, -- สาขาหลัก
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code) -- ห้ามมีรหัสสาขาซ้ำในองค์กรเดียวกัน
);

-- Index
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy: ดูได้เฉพาะสาขาในองค์กรตัวเอง
CREATE POLICY "Users can view own org branches"
ON branches FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Owner/Manager สร้าง/แก้ไขสาขาได้
CREATE POLICY "Admins can manage branches"
ON branches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager') 
    AND organization_id = branches.organization_id
  )
);

-- ============================================
-- 2. สร้างสาขาแรก (Main Branch) ให้กับทุก Organization ที่มีอยู่
-- ============================================
DO $$
DECLARE
  org_rec RECORD;
  main_branch_id UUID;
BEGIN
  FOR org_rec IN SELECT id FROM organizations
  LOOP
    -- สร้างสาขาหลักถ้ายังไม่มี
    INSERT INTO branches (organization_id, name, code, is_main)
    VALUES (org_rec.id, 'สำนักงานใหญ่ (Headquarters)', 'HQ', TRUE)
    ON CONFLICT DO NOTHING
    RETURNING id INTO main_branch_id;
    
    -- ถ้า insert ไม่ได้ (เพราะมีแล้ว) ให้ไป select มาแทน
    IF main_branch_id IS NULL THEN
        SELECT id INTO main_branch_id FROM branches WHERE organization_id = org_rec.id AND key_main = TRUE LIMIT 1;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 3. อัปเดตตาราง profiles และ orders ให้สังกัดสาขา
-- ============================================

-- เพิ่มคอลัมน์ branch_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- อัปเดตข้อมูลเดิมให้ไปอยู่สาขาหลัก (ของแต่ละองค์กร)
UPDATE profiles p
SET branch_id = (SELECT id FROM branches b WHERE b.organization_id = p.organization_id AND b.is_main = TRUE LIMIT 1)
WHERE branch_id IS NULL;

UPDATE orders o
SET branch_id = (SELECT id FROM branches b WHERE b.organization_id = o.organization_id AND b.is_main = TRUE LIMIT 1)
WHERE branch_id IS NULL;

UPDATE shifts s
SET branch_id = (SELECT id FROM branches b WHERE b.organization_id = s.organization_id AND b.is_main = TRUE LIMIT 1)
WHERE branch_id IS NULL;

-- ============================================
-- 4. แยกสต็อกสินค้า (Product Stocks)
-- ============================================

CREATE TABLE IF NOT EXISTS product_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, branch_id) -- สินค้า 1 ตัว มีได้ 1 record ต่อสาขา
);

-- Index
CREATE INDEX IF NOT EXISTS idx_product_stocks_product ON product_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stocks_branch ON product_stocks(branch_id);

-- Enable RLS
ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stocks in their org"
ON product_stocks FOR SELECT
USING (
  branch_id IN (
    SELECT id FROM branches WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Admins/Staff can update stocks in their org"
ON product_stocks FOR ALL
USING (
  branch_id IN (
    SELECT id FROM branches WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
);

-- ============================================
-- 5. ย้ายข้อมูลสต็อกเดิม (Migration Data)
-- ============================================

-- ย้าย current_stock จากตาราง products ลง product_stocks (เข้าสาขาหลัก)
INSERT INTO product_stocks (product_id, branch_id, quantity)
SELECT 
  p.id, 
  (SELECT id FROM branches b WHERE b.organization_id = p.organization_id AND b.is_main = TRUE LIMIT 1),
  p.current_stock
FROM products p
WHERE p.current_stock > 0
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- หมายเหตุ: เรายังไม่ลบคอลัมน์ current_stock ใน products เผื่อไว้ก่อน แต่หลังจากนี้ควรใช้จาก product_stocks แทน
