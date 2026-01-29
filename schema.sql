-- 1. Enable UUID Extension (สร้าง ID แบบสุ่มยาวๆ ป้องกันการเดาเลข)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- A. CORE SYSTEM (บริษัท & การจัดการสิทธิ์)
-- --------------------------------------------------------

-- ตารางรายชื่อลูกค้า (ร้านค้า/บริษัท)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- เช่น 'shop-a' เอาไว้ทำ sub-domain
    subscription_status TEXT CHECK (subscription_status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED')) DEFAULT 'TRIAL',
    subscription_ends_at TIMESTAMPTZ,
    config_settings JSONB DEFAULT '{}', -- เก็บ Logo, สี Theme, อัตราภาษี
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางแผนก (Department Hierarchy)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- เช่น 'ฝ่ายขาย', 'คลังสินค้า'
    parent_id UUID REFERENCES departments(id), -- กรณีมีแผนกย่อย
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ข้อมูล User เพิ่มเติม (เชื่อมกับ Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id), -- ผูกกับตาราง User หลักของ Supabase
    organization_id UUID REFERENCES organizations(id),
    department_id UUID REFERENCES departments(id), -- ถ้า NULL = เห็นทั้งหมด (เช่น Owner)
    role TEXT CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
    full_name TEXT
);

-- --------------------------------------------------------
-- B. DYNAMIC ENGINE (ระบบสร้างฟอร์มตามสั่ง)
-- --------------------------------------------------------

-- ตารางหมวดหมู่สินค้า
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางนิยามฟิลด์ข้อมูล (Blueprint) - หัวใจของความยืดหยุ่น
CREATE TABLE category_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL, -- ชื่อในโปรแกรม เช่น 'cpu_speed'
    field_label TEXT NOT NULL, -- ชื่อโชว์ลูกค้า เช่น 'ความเร็ว CPU'
    field_type TEXT CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX')),
    field_options JSONB, -- เก็บตัวเลือก Dropdown เช่น ["S", "M", "L"]
    is_required BOOLEAN DEFAULT FALSE,
    UNIQUE(category_id, field_key)
);

-- --------------------------------------------------------
-- C. BUSINESS DATA (สินค้า & การขาย)
-- --------------------------------------------------------

-- ตารางสินค้า
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id), -- ผูกกับหมวดหมู่
    
    -- ฟิลด์มาตรฐาน
    sku TEXT,
    name TEXT NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    selling_price DECIMAL(10,2) DEFAULT 0,
    current_stock INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    
    -- ฟิลด์พิเศษ (Dynamic Data) เก็บค่าตามที่นิยามไว้ใน category_field_definitions
    attributes JSONB DEFAULT '{}', 
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางคำสั่งซื้อ (Order)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    department_id UUID REFERENCES departments(id), -- ขายโดยแผนกไหน
    seller_id UUID REFERENCES profiles(id), -- ใครขาย
    
    total_amount DECIMAL(10,2),
    payment_method TEXT,
    status TEXT DEFAULT 'COMPLETED',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางรายการสินค้าในออเดอร์ (Line Items) **สำคัญเรื่องกำไร/ขาดทุน**
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    
    quantity INT NOT NULL,
    
    -- SNAPSHOT: ต้องบันทึกราคาและต้นทุน "ณ เวลาที่ขาย" ห้าม Link ไปเอาจากตาราง Product
    price_at_sale DECIMAL(10,2) NOT NULL,
    cost_at_sale DECIMAL(10,2) NOT NULL 
);

-- --------------------------------------------------------
-- D. EXPENSE MANAGEMENT (ระบบค่าใช้จ่ายแบบ Dynamic)
-- --------------------------------------------------------

-- ตารางหมวดหมู่ค่าใช้จ่าย (User-defined)
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- ชื่อหมวดหมู่ เช่น 'ค่ากาแฟ', 'ค่าจ้าง Freelance'
    group_type TEXT CHECK (group_type IN ('COST', 'SELLING', 'ADMIN')) NOT NULL, -- กลุ่มสำหรับ P&L
    is_system BOOLEAN DEFAULT FALSE, -- หมวดหมู่เริ่มต้นระบบ ลบไม่ได้
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางรายจ่าย (Expense) - Updated to use dynamic categories
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    department_id UUID REFERENCES departments(id), -- แผนกไหนใช้เงิน
    category_id UUID REFERENCES expense_categories(id), -- FK ไปหมวดหมู่ค่าใช้จ่าย
    
    title TEXT NOT NULL, -- คำอธิบายรายการ
    amount DECIMAL(10,2) NOT NULL,
    receipt_image_url TEXT,
    recipient_name TEXT, -- ชื่อผู้รับเงิน (สำหรับ Commission)
    
    expense_date DATE DEFAULT CURRENT_DATE
);

-- สร้าง Index เพื่อความเร็วในการค้นหา
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_attributes ON products USING GIN (attributes); -- ค้นหาใน JSONB เร็วขึ้น
CREATE INDEX idx_expense_categories_org ON expense_categories(organization_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);

-- --------------------------------------------------------
-- E. DEFAULT EXPENSE CATEGORIES (ข้อมูลเริ่มต้น)
-- --------------------------------------------------------
-- Run this after creating organization to seed default categories:
-- 
-- INSERT INTO expense_categories (organization_id, name, group_type, is_system) VALUES
-- ('your-org-id', 'ค่าระบบ (HMS)', 'COST', TRUE),
-- ('your-org-id', 'ค่าอุปกรณ์', 'COST', TRUE),
-- ('your-org-id', 'ค่าโฆษณา', 'SELLING', TRUE),
-- ('your-org-id', 'คอมมิชชั่น', 'SELLING', TRUE),
-- ('your-org-id', 'Incentive', 'SELLING', TRUE),
-- ('your-org-id', 'เงินเดือน', 'ADMIN', TRUE),
-- ('your-org-id', 'ค่าเช่า', 'ADMIN', TRUE),
-- ('your-org-id', 'ค่าน้ำค่าไฟ', 'ADMIN', TRUE),
-- ('your-org-id', 'ค่าทำความสะอาด', 'ADMIN', TRUE),
-- ('your-org-id', 'ค่าไปรษณีย์', 'ADMIN', TRUE);

