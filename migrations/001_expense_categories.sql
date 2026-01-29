-- ========================================
-- MIGRATION: Dynamic Expense Categories
-- ========================================
-- Run this in Supabase SQL Editor

-- 1. สร้างตาราง expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('COST', 'SELLING', 'ADMIN')) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. เพิ่มคอลัมน์ใน expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES expense_categories(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE;

-- 3. สร้าง Index
CREATE INDEX IF NOT EXISTS idx_expense_categories_org ON expense_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- 4. ปิด RLS สำหรับ expense_categories (หรือสร้าง policy ถ้าต้องการ)
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;

-- ========================================
-- SUCCESS! ทำขั้นตอนต่อไป:
-- 1. ไปที่หน้า /dashboard/settings/expenses
-- 2. กดปุ่ม "สร้างหมวดหมู่เริ่มต้น"
-- ========================================
