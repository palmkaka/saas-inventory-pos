-- Migration: Customer Loyalty Program
-- Description: สร้างระบบสะสมแต้มลูกค้า
-- Created: 2026-01-31

-- ============================================
-- 1. เพิ่มการตั้งค่าแต้มในตาราง organizations
-- ============================================
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS points_per_currency INTEGER DEFAULT 100, -- ซื้อกี่บาทได้ 1 แต้ม
ADD COLUMN IF NOT EXISTS points_to_currency INTEGER DEFAULT 10; -- กี่แต้มแลกได้ 1 บาท

COMMENT ON COLUMN organizations.loyalty_enabled IS 'เปิดใช้งานระบบแต้มสะสมหรือไม่';
COMMENT ON COLUMN organizations.points_per_currency IS 'ซื้อกี่บาทได้ 1 แต้ม (default: 100 บาท = 1 แต้ม)';
COMMENT ON COLUMN organizations.points_to_currency IS 'กี่แต้มแลกได้ 1 บาท (default: 10 แต้ม = 1 บาท)';

-- ============================================
-- 2. สร้างตาราง customers (ลูกค้า)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, -- เบอร์โทรเป็น Primary Identifier
  name TEXT NOT NULL,
  email TEXT,
  points INTEGER DEFAULT 0, -- แต้มสะสมปัจจุบัน
  total_spent DECIMAL(10, 2) DEFAULT 0, -- ยอดซื้อสะสมทั้งหมด
  visit_count INTEGER DEFAULT 0, -- จำนวนครั้งที่ซื้อ
  notes TEXT, -- บันทึกเพิ่มเติม
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, phone) -- เบอร์โทรไม่ซ้ำในแต่ละองค์กร
);

-- Index
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_points ON customers(points);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their org customers
CREATE POLICY "Users see their org customers"
ON customers FOR ALL
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
-- 3. อัปเดตตาราง orders เพื่อรองรับแต้ม
-- ============================================
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0, -- แต้มที่ได้รับจากออเดอร์นี้
ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0, -- แต้มที่ใช้แลกส่วนลด
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0; -- ส่วนลดจากแต้ม

-- Index
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- ============================================
-- 4. สร้างตาราง customer_point_history (ประวัติการใช้แต้ม)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  points_change INTEGER NOT NULL, -- +เพิ่ม, -ลด
  balance_after INTEGER NOT NULL, -- ยอดแต้มหลังเปลี่ยนแปลง
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_point_history_customer ON customer_point_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_history_created ON customer_point_history(created_at);

-- Enable RLS
ALTER TABLE customer_point_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their org point history
CREATE POLICY "Users see their org point history"
ON customer_point_history FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers 
    WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);

-- ============================================
-- 5. สร้าง Function คำนวณแต้ม
-- ============================================

-- Function: คำนวณแต้มที่ได้รับจากยอดซื้อ
CREATE OR REPLACE FUNCTION calculate_points_earned(
  org_id UUID,
  amount DECIMAL
)
RETURNS INTEGER AS $$
DECLARE
  points_per_currency INTEGER;
BEGIN
  SELECT organizations.points_per_currency INTO points_per_currency
  FROM organizations
  WHERE id = org_id;
  
  IF points_per_currency IS NULL OR points_per_currency = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN FLOOR(amount / points_per_currency)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function: คำนวณส่วนลดจากแต้ม
CREATE OR REPLACE FUNCTION calculate_discount_from_points(
  org_id UUID,
  points INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
  points_to_currency INTEGER;
BEGIN
  SELECT organizations.points_to_currency INTO points_to_currency
  FROM organizations
  WHERE id = org_id;
  
  IF points_to_currency IS NULL OR points_to_currency = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN FLOOR(points / points_to_currency)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. สร้าง Trigger อัปเดตยอดลูกค้าอัตโนมัติ
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    -- อัปเดตยอดซื้อและจำนวนครั้ง
    UPDATE customers
    SET 
      total_spent = total_spent + NEW.total_amount,
      visit_count = visit_count + 1,
      updated_at = NOW()
    WHERE id = NEW.customer_id;
    
    -- เพิ่มแต้ม (ถ้ามี)
    IF NEW.points_earned > 0 THEN
      UPDATE customers
      SET 
        points = points + NEW.points_earned,
        updated_at = NOW()
      WHERE id = NEW.customer_id;
      
      -- บันทึกประวัติ
      INSERT INTO customer_point_history (
        customer_id,
        order_id,
        points_change,
        balance_after,
        type,
        description
      )
      SELECT 
        NEW.customer_id,
        NEW.id,
        NEW.points_earned,
        points,
        'earned',
        'รับแต้มจากการซื้อ ' || NEW.total_amount || ' บาท'
      FROM customers
      WHERE id = NEW.customer_id;
    END IF;
    
    -- ลดแต้ม (ถ้าใช้แลก)
    IF NEW.points_redeemed > 0 THEN
      UPDATE customers
      SET 
        points = points - NEW.points_redeemed,
        updated_at = NOW()
      WHERE id = NEW.customer_id;
      
      -- บันทึกประวัติ
      INSERT INTO customer_point_history (
        customer_id,
        order_id,
        points_change,
        balance_after,
        type,
        description
      )
      SELECT 
        NEW.customer_id,
        NEW.id,
        -NEW.points_redeemed,
        points,
        'redeemed',
        'ใช้แต้มแลกส่วนลด ' || NEW.discount_amount || ' บาท'
      FROM customers
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง Trigger
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON orders;
CREATE TRIGGER trigger_update_customer_stats
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_stats();
