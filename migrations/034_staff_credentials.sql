-- Create table for storing staff credentials (strictly for Owner viewing)
CREATE TABLE IF NOT EXISTS staff_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    plain_password TEXT NOT NULL, -- Storing purely for Owner recovery feature as requested
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE staff_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Only Organization Owner can VIEW credentials
CREATE POLICY "Owners can view staff credentials"
    ON staff_credentials
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = staff_credentials.organization_id
            AND profiles.role = 'owner'
        )
    );

-- Policy: Only Organization Owner/Manager can INSERT (via server action usually, but good to have)
CREATE POLICY "Admins can insert staff credentials"
    ON staff_credentials
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = staff_credentials.organization_id
            AND profiles.role IN ('owner', 'manager')
        )
    );

-- Policy: Owners can DELETE
CREATE POLICY "Owners can delete credentials"
    ON staff_credentials
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = staff_credentials.organization_id
            AND profiles.role = 'owner'
        )
    );
