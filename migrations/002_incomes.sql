-- ========================================
-- MIGRATION: Income Recording System
-- รันใน Supabase SQL Editor
-- ========================================

-- 1. สร้างตาราง income_categories (หมวดหมู่รายรับ)
CREATE TABLE IF NOT EXISTS income_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    income_type TEXT CHECK (income_type IN ('SALES', 'SERVICE', 'OTHER')) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. สร้างตาราง incomes (รายรับ)
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES income_categories(id),
    title TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payer_name TEXT,
    income_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. สร้าง Index
CREATE INDEX IF NOT EXISTS idx_income_categories_org ON income_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_incomes_org ON incomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(income_date);

-- 4. ปิด RLS
ALTER TABLE income_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE incomes DISABLE ROW LEVEL SECURITY;

-- ========================================
-- SUCCESS! ไปหน้า /dashboard/settings/incomes
-- แล้วกด "สร้างหมวดหมู่เริ่มต้น"
-- ========================================
