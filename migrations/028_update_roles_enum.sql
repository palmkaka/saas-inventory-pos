-- Migration: Update Roles Enum
-- Description: เพิ่ม Roles ใหม่สำหรับ Sales และ Inventory และปรับปรุง Constraint
-- Created: 2026-02-01

-- 1. Drop old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add new constraint with strict roles
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
    'owner',        -- เจ้าของ (God View)
    'manager',      -- ผู้จัดการ (General Manager / Branch Manager)
    'accountant',   -- บัญชี (HQ / Branch)
    'hr',           -- ฝ่ายบุคคล (HQ / Branch)
    'sales',        -- พนักงานขาย (Branch)
    'inventory',    -- พนักงานคลัง (Branch)
    'staff'         -- (Deprecated) เก็บไว้กันข้อมูลเก่า Error
));

-- 3. Update existing 'staff' to 'sales' (Optional: default migration strategy)
-- UPDATE profiles SET role = 'sales' WHERE role = 'staff';
