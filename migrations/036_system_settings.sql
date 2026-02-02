-- Migration: System Settings
-- Description: เพิ่มตารางสำหรับตั้งค่าระบบรวม (Maintenance Mode, Allow Signups)
-- Created: 2026-02-03

-- 1. Create table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id)
);

-- 2. Insert default values
INSERT INTO system_settings (key, value, description)
VALUES 
    ('maintenance_mode', 'false', 'Enable to block access for non-admin users'),
    ('allow_signups', 'true', 'Enable to allow new user registrations')
ON CONFLICT (key) DO NOTHING;

-- 3. RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 3.1 Read Access: Public (Everyone needs to know if system is down)
CREATE POLICY "Everyone can read system settings"
ON system_settings FOR SELECT
USING (true);

-- 3.2 Update Access: Super Admins Only
CREATE POLICY "Super Admins can update system settings"
ON system_settings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND is_platform_admin = TRUE
    )
);
