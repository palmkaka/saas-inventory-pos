-- Migration: Multi-Tenant SaaS Foundation
-- Description: สร้างโครงสร้างพื้นฐานสำหรับระบบ Multi-Tenant
-- Created: 2026-01-31

-- ============================================
-- 1. อัปเดตตาราง organizations (บริษัทลูกค้า)
-- ============================================
-- เพิ่มคอลัมน์ที่ขาดหายไป (ถ้ายังไม่มี)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- สร้าง unique constraint สำหรับ slug (ถ้ายังไม่มี)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_slug_key'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
  END IF;
END $$;

-- ============================================
-- 2. สร้างตาราง subscriptions (แพ็คเกจ)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  max_users INTEGER DEFAULT 5, -- จำนวน User สูงสุด
  max_products INTEGER DEFAULT 100, -- จำนวนสินค้าสูงสุด
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- วันหมดอายุ (NULL = ไม่มีวันหมดอายุ)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. เพิ่มคอลัมน์ organization_id ในตารางเดิม
-- ============================================

-- 3.1 ตาราง profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_support_staff BOOLEAN DEFAULT FALSE;

-- 3.2 ตาราง products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.3 ตาราง categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.4 ตาราง orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.5 ตาราง order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.6 ตาราง expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.7 ตาราง expense_categories
ALTER TABLE expense_categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.8 ตาราง incomes
ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 3.9 ตาราง income_categories
ALTER TABLE income_categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- 4. สร้าง Indexes เพื่อเพิ่มความเร็ว
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_incomes_org ON incomes(organization_id);

-- ============================================
-- 5. Row-Level Security (RLS) Policies
-- ============================================

-- 5.1 Enable RLS สำหรับทุกตาราง
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;

-- 5.2 Policy: Platform Admin เห็นทุกอย่าง
CREATE POLICY "Platform admins see all organizations"
ON organizations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);

-- 5.3 Policy: Support Staff เห็นทุกอย่าง (แต่แก้ไขไม่ได้)
CREATE POLICY "Support staff view all organizations"
ON organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_support_staff = TRUE
  )
);

-- 5.4 Policy: Users เห็นแค่องค์กรตัวเอง
CREATE POLICY "Users see their own organization"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- 5.5 Policy: Products - Users เห็นแค่สินค้าในองค์กรตัวเอง
CREATE POLICY "Users see their org products"
ON products FOR ALL
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

-- 5.6 Policy: Orders - Users เห็นแค่ออเดอร์ในองค์กรตัวเอง
CREATE POLICY "Users see their org orders"
ON orders FOR ALL
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

-- 5.7 Policy: Expenses - Users เห็นแค่รายจ่ายในองค์กรตัวเอง
CREATE POLICY "Users see their org expenses"
ON expenses FOR ALL
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

-- 5.8 Policy: Incomes - Users เห็นแค่รายรับในองค์กรตัวเอง
CREATE POLICY "Users see their org incomes"
ON incomes FOR ALL
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

-- ============================================
-- 6. สร้างองค์กรเริ่มต้น (Demo Organization)
-- ============================================
INSERT INTO organizations (id, name, slug, address, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Company',
  'demo',
  '123 ถนนสุขุมวิท กรุงเทพฯ',
  '02-123-4567',
  'demo@evolutionhrd.com'
) ON CONFLICT (id) DO NOTHING;

-- สร้าง Subscription สำหรับ Demo Company
INSERT INTO subscriptions (organization_id, plan, status, max_users, max_products)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'pro',
  'active',
  999,
  9999
) ON CONFLICT DO NOTHING;

-- ============================================
-- 7. อัปเดตข้อมูลเดิมให้เชื่อมกับ Demo Organization
-- ============================================
UPDATE profiles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE categories SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE orders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE order_items SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE expense_categories SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE incomes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE income_categories SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
