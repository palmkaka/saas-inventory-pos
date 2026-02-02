-- Migration: Time Attendance
-- Description: ระบบบันทึกเวลาทำงาน (Check-in / Check-out)
-- Created: 2026-01-31

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  work_duration_minutes INTEGER, -- Calculated on clock_out
  status TEXT NOT NULL DEFAULT 'ON_DUTY' CHECK (status IN ('ON_DUTY', 'COMPLETED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_time_entries_org ON time_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_branch ON time_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(clock_in);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own entries
CREATE POLICY "Users can view own time entries"
ON time_entries FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Managers/Owners can view all entries in their org
CREATE POLICY "Managers can view org time entries"
ON time_entries FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  )
);

-- Policy: Users can insert their own entries (Clock In)
CREATE POLICY "Users can clock in"
ON time_entries FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Users can update their own entries (Clock Out) - Only if ON_DUTY
CREATE POLICY "Users can clock out"
ON time_entries FOR UPDATE
USING (auth.uid() = user_id AND status = 'ON_DUTY')
WITH CHECK (auth.uid() = user_id);

-- Function to calculate duration on update
CREATE OR REPLACE FUNCTION calculate_work_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL THEN
    NEW.status = 'COMPLETED';
    -- Calculate minutes difference
    NEW.work_duration_minutes = EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER on_time_entry_update
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION calculate_work_duration();
