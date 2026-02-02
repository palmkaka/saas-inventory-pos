-- Migration: Commission Calculation
-- Description: ระบบคำนวณคอมมิชชั่นพนักงาน
-- Created: 2026-01-31

-- ตารางตั้งค่าคอมมิชชั่น
CREATE TABLE IF NOT EXISTS commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- ชื่อกฎ เช่น "คอมมิชชั่นทั่วไป"
  commission_type TEXT NOT NULL CHECK (commission_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  rate DECIMAL(10, 2) NOT NULL, -- อัตรา (% หรือ บาท)
  applies_to TEXT NOT NULL DEFAULT 'ALL' CHECK (applies_to IN ('ALL', 'CATEGORY', 'PRODUCT')),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางบันทึกคอมมิชชั่นที่คำนวณได้
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID, -- อ้างอิง order item (ถ้ามี)
  commission_setting_id UUID REFERENCES commission_settings(id) ON DELETE SET NULL,
  sale_amount DECIMAL(10, 2) NOT NULL, -- ยอดขายที่ใช้คำนวณ
  commission_amount DECIMAL(10, 2) NOT NULL, -- จำนวนเงินคอมมิชชั่น
  period_month DATE, -- งวดเดือน (วันที่ 1 ของเดือน)
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_settings_org ON commission_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_org ON commission_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_user ON commission_records(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_period ON commission_records(period_month);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);

-- Enable RLS
ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_settings
CREATE POLICY "Users can view commission settings in their org"
ON commission_settings FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Owners can manage commission settings"
ON commission_settings FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  )
);

-- RLS Policies for commission_records
CREATE POLICY "Users can view own commission records"
ON commission_records FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Managers can view all commission records in org"
ON commission_records FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  )
);

CREATE POLICY "System can insert commission records"
ON commission_records FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Owners can update commission records"
ON commission_records FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role = 'owner'
  )
);
