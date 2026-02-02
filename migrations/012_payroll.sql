-- Migration: Payroll System
-- Description: ระบบเงินเดือนพนักงาน
-- Created: 2026-01-31

-- ตารางตั้งค่าเงินเดือนพนักงาน
CREATE TABLE IF NOT EXISTS employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  salary_type TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (salary_type IN ('MONTHLY', 'DAILY', 'HOURLY')),
  base_amount DECIMAL(12, 2) NOT NULL DEFAULT 0, -- เงินเดือน/ค่าแรงพื้นฐาน
  position_allowance DECIMAL(12, 2) DEFAULT 0, -- ค่าตำแหน่ง
  diligence_allowance DECIMAL(12, 2) DEFAULT 0, -- เบี้ยขยัน
  other_allowance DECIMAL(12, 2) DEFAULT 0, -- เบี้ยเลี้ยงอื่นๆ
  social_security_enabled BOOLEAN DEFAULT TRUE, -- หักประกันสังคม
  withholding_tax_enabled BOOLEAN DEFAULT TRUE, -- หักภาษี ณ ที่จ่าย
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ตารางหนี้สิน/เงินกู้พนักงาน
CREATE TABLE IF NOT EXISTS employee_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  loan_name TEXT NOT NULL, -- ชื่อรายการ เช่น "เงินกู้ยืม", "ค่าเครื่องแบบ"
  total_amount DECIMAL(12, 2) NOT NULL, -- ยอดรวมทั้งหมด
  monthly_deduction DECIMAL(12, 2) NOT NULL, -- หักต่อเดือน
  remaining_amount DECIMAL(12, 2) NOT NULL, -- ยอดคงเหลือ
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางงวดเงินเดือน
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL, -- เช่น "มกราคม 2569"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID')),
  calculated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางรายการเงินเดือนรายคน
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- รายรับ
  base_salary DECIMAL(12, 2) DEFAULT 0, -- เงินเดือนพื้นฐาน
  hours_worked DECIMAL(10, 2) DEFAULT 0, -- ชั่วโมงทำงาน
  days_worked INTEGER DEFAULT 0, -- วันทำงาน
  position_allowance DECIMAL(12, 2) DEFAULT 0, -- ค่าตำแหน่ง
  diligence_allowance DECIMAL(12, 2) DEFAULT 0, -- เบี้ยขยัน
  other_allowance DECIMAL(12, 2) DEFAULT 0, -- เบี้ยเลี้ยงอื่นๆ
  commission_total DECIMAL(12, 2) DEFAULT 0, -- คอมมิชชั่นรวม
  overtime_pay DECIMAL(12, 2) DEFAULT 0, -- ค่าล่วงเวลา
  total_earnings DECIMAL(12, 2) DEFAULT 0, -- รายรับรวม
  
  -- รายหัก
  social_security DECIMAL(12, 2) DEFAULT 0, -- ประกันสังคม (5% max 750)
  withholding_tax DECIMAL(12, 2) DEFAULT 0, -- ภาษีหัก ณ ที่จ่าย
  loan_deduction DECIMAL(12, 2) DEFAULT 0, -- หักเงินกู้
  other_deduction DECIMAL(12, 2) DEFAULT 0, -- หักอื่นๆ
  absent_deduction DECIMAL(12, 2) DEFAULT 0, -- หักขาดงาน
  total_deductions DECIMAL(12, 2) DEFAULT 0, -- รายหักรวม
  
  -- สุทธิ
  net_salary DECIMAL(12, 2) DEFAULT 0, -- เงินเดือนสุทธิ
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_salaries_org ON employee_salaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_user ON employee_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_org ON payroll_periods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_user ON payroll_records(user_id);

-- Enable RLS
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_salaries
CREATE POLICY "Managers can view employee salaries"
ON employee_salaries FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager', 'hr')
  )
);

CREATE POLICY "Owners can manage employee salaries"
ON employee_salaries FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'hr')
  )
);

-- RLS Policies for employee_loans
CREATE POLICY "Managers can view employee loans"
ON employee_loans FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager', 'hr')
  )
);

CREATE POLICY "Owners can manage employee loans"
ON employee_loans FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'hr')
  )
);

-- RLS Policies for payroll_periods
CREATE POLICY "Managers can view payroll periods"
ON payroll_periods FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager', 'hr', 'accountant')
  )
);

CREATE POLICY "Owners can manage payroll periods"
ON payroll_periods FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'hr')
  )
);

-- RLS Policies for payroll_records
CREATE POLICY "Users can view own payroll records"
ON payroll_records FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Managers can view all payroll records"
ON payroll_records FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager', 'hr', 'accountant')
  )
);

CREATE POLICY "Owners can manage payroll records"
ON payroll_records FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'hr')
  )
);
