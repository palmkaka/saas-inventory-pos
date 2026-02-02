-- Enable RLS on branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Remove policies to ensure idempotency
DROP POLICY IF EXISTS "branches_read_all" ON branches;
DROP POLICY IF EXISTS "branches_isolate_policy" ON branches;
DROP POLICY IF EXISTS "branches_strict_access" ON branches; -- Added this line

-- Create strict organization isolation policy for branches
CREATE POLICY "branches_strict_access" ON branches
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);

-- Enable RLS on time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Remove policies
DROP POLICY IF EXISTS "time_entries_read_all" ON time_entries;
DROP POLICY IF EXISTS "users_read_org_time_entries" ON time_entries;
DROP POLICY IF EXISTS "time_entries_isolate_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_strict_access" ON time_entries; -- Added this line

-- Create strict organization isolation policy for time_entries
CREATE POLICY "time_entries_strict_access" ON time_entries
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);
