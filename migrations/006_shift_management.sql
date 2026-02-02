-- Migration: Shift Management
-- Description: สร้างระบบจัดการกะการทำงาน (Shift Management)
-- Created: 2026-01-31

-- ============================================
-- 1. สร้างตาราง shifts (กะการทำงาน)
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  starting_cash DECIMAL(10, 2) NOT NULL DEFAULT 0, -- เงินสดตอนเริ่มกะ
  ending_cash DECIMAL(10, 2), -- เงินสดที่นับได้ตอนปิดกะ
  expected_cash DECIMAL(10, 2), -- เงินสดที่ควรจะมี (เงินต้น + ยอดขายเงินสด)
  cash_difference DECIMAL(10, 2), -- ส่วนต่าง (+ เกิน, - ขาด)
  total_sales DECIMAL(10, 2) DEFAULT 0, -- ยอดขายรวมในกะ
  total_orders INTEGER DEFAULT 0, -- จำนวนออเดอร์ในกะ
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_started_at ON shifts(started_at);

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own shifts, Owner/Manager can view all in org
CREATE POLICY "Users view own and admins view all shifts"
ON shifts FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'manager')
    AND organization_id = shifts.organization_id
  )
);

-- Policy: Users can create their own shifts
CREATE POLICY "Users can create their own shifts"
ON shifts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Policy: Users can update their own shifts (e.g. closing shift)
CREATE POLICY "Users can update their own shifts"
ON shifts FOR UPDATE
USING (
  auth.uid() = user_id
);

-- ============================================
-- 2. อัปเดตตาราง orders เพื่อเชื่อมโยงกะ
-- ============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);

-- ============================================
-- 3. Trigger เพื่ออัปเดตยอดขายในกะอัตโนมัติ
-- ============================================
CREATE OR REPLACE FUNCTION update_shift_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- ทำงานเฉพาะเมื่อมี shift_id และสถานะเป็น COMPLETED
  IF NEW.shift_id IS NOT NULL AND NEW.status = 'COMPLETED' THEN
    UPDATE shifts
    SET
      total_sales = total_sales + NEW.total_amount,
      total_orders = total_orders + 1,
      updated_at = NOW()
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shift_stats ON orders;
CREATE TRIGGER trigger_update_shift_stats
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_shift_stats();
