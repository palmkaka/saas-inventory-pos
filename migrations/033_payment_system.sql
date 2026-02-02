-- Migration: Payment Verification System
-- Description: เพิ่มตาราง payment_transactions และการจัดการ Storage สำหรับสลิปโอนเงิน
-- Created: 2026-02-02

-- ============================================
-- 1. สร้างตาราง payment_transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  slip_url TEXT, -- URL ของรูปสลิปใน Storage
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  type TEXT DEFAULT 'transfer', -- 'transfer' (โอนเงิน), 'credit_card' (ตัดบัตร - อนาคต)
  plan_id TEXT, -- ID ของแพ็กเกจที่ซื้อ (ถ้ามี)
  notes TEXT, -- หมายเหตุจาก Admin (เช่น "สลิปปลอม", "ยอดไม่ครบ")
  payment_date TIMESTAMPTZ DEFAULT NOW(), -- วันที่แจ้งโอน
  verified_at TIMESTAMPTZ, -- วันที่ Admin ตรวจสอบ
  verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin คนที่ตรวจสอบ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payments_org ON payment_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users เห็นรายการโอนขององค์กรตัวเอง
CREATE POLICY "Users see their org payments"
ON payment_transactions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Users แจ้งโอนเงินได้ (Insert)
CREATE POLICY "Users can create payment records"
ON payment_transactions FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'accountant') -- เฉพาะระดับหัวหน้า
  )
);

-- Policy: Super Admin จัดการได้ทุกอย่าง
CREATE POLICY "Super Admins manage all payments"
ON payment_transactions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);

-- ============================================
-- 2. ตั้งค่า Storage Bucket (payment-slips)
-- ============================================
-- หมายเหตุ: การสร้าง Bucket จริงต้องทำผ่าน Dashboard หรือ Triggers แต่เราจะใส่ Policy รองรับไว้

-- Policy: ให้ User อัปโหลดไฟล์ได้ (เฉพาะ Owner/Manager/Accountant)
-- ต้องไปสร้าง Bucket ชื่อ 'payment-slips' ใน Supabase Dashboard และตั้งเป็น Private

-- ตัวอย่าง Policy SQL (ถ้าสามารถรันใน SQL Editor ได้)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-slips', 'payment-slips', false) ON CONFLICT DO NOTHING;

-- Policy สำหรับ storage.objects
CREATE POLICY "Users give access to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Users view own folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM profiles WHERE id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Super Admins view all slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-slips' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_platform_admin = TRUE
  )
);
