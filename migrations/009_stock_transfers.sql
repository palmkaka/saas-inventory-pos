-- Migration: Stock Transfers
-- Description: ระบบโอนย้ายสินค้าระหว่างสาขา
-- Created: 2026-01-31

CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  destination_branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_stock_transfers_org ON stock_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON stock_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON stock_transfers(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);

-- Enable RLS
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: ดูรายการโอนย้ายขององค์กรตัวเอง
CREATE POLICY "Users can view own org transfers"
ON stock_transfers FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: สร้างรายการโอนย้ายได้ (Staff/Manager/Owner)
CREATE POLICY "Users can create transfers"
ON stock_transfers FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: อัปเดตสถานะ (Manager/Owner หรือ Destination Branch Manager)
-- เพื่อความง่าย ให้ Manager/Owner อัปเดตได้ทุกอย่าง ส่วน Staff อาจจะจำกัด
CREATE POLICY "Users can update transfers"
ON stock_transfers FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Function: ตัดสต็อกเมื่อสร้างรายการ (Optional: หรือจะตัดตอน Approve ก็ได้ แต่ตัดเลยดีกว่าเพื่อจองของ)
-- แต่ถ้าตัดเลย ถ้า Reject ต้องคืนของ
-- เอาแบบง่าย: ตัดตอน Approve/Completed ดีกว่า หรือจะใช้ Transaction ในโค้ดก็ได้
-- เพื่อความปลอดภัย ใช้ Transaction ใน Frontend/API call ดีกว่าใน Trigger ซับซ้อน

-- Function to handle stock movement on status change
CREATE OR REPLACE FUNCTION handle_stock_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- กรณีอนุมัติ/สำเร็จ (COMPLETED) => ตัดของจากต้นทาง เพิ่มของไปปลายทาง
  -- สมมติว่า flow คือ PENDING -> APPROVED (แพ็คของ) -> COMPLETED (ของถึง)
  -- หรือ Simple Flow: PENDING -> COMPLETED (ทันทีที่กดยืนยันรับของ)
  
  -- ถ้าเปลี่ยนเป็น COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- 1. ตัดจากต้นทาง (Source)
    UPDATE product_stocks
    SET quantity = quantity - NEW.quantity, updated_at = NOW()
    WHERE product_id = NEW.product_id AND branch_id = NEW.source_branch_id;
    
    -- 2. เพิ่มไปปลายทาง (Destination) - Upsert
    INSERT INTO product_stocks (product_id, branch_id, quantity)
    VALUES (NEW.product_id, NEW.destination_branch_id, NEW.quantity)
    ON CONFLICT (product_id, branch_id) 
    DO UPDATE SET quantity = product_stocks.quantity + EXCLUDED.quantity, updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER on_stock_transfer_update
AFTER UPDATE ON stock_transfers
FOR EACH ROW
EXECUTE FUNCTION handle_stock_transfer();
