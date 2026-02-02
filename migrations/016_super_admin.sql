-- Migration: Super Admin & Subscriptions
-- Description: เพิ่มระบบ Super Admin และ Subscription
-- Created: 2026-01-31

-- เพิ่ม is_super_admin ในตาราง profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- เพิ่ม subscription fields ในตาราง organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- ตาราง Announcements (ประกาศ)
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, warning, maintenance
    is_active BOOLEAN DEFAULT TRUE,
    target_plans TEXT[], -- null = all plans
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price DECIMAL(12, 2) DEFAULT 0,
    billing_period TEXT DEFAULT 'monthly', -- monthly, yearly
    max_products INTEGER DEFAULT 100,
    max_branches INTEGER DEFAULT 1,
    max_employees INTEGER DEFAULT 5,
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, price, max_products, max_branches, max_employees, features, sort_order)
VALUES 
    ('free', 'Free', 0, 50, 1, 2, '{"pos": true, "reports": false, "api": false}', 1),
    ('starter', 'Starter', 299, 200, 1, 5, '{"pos": true, "reports": true, "api": false}', 2),
    ('business', 'Business', 799, 1000, 3, 20, '{"pos": true, "reports": true, "api": true}', 3),
    ('enterprise', 'Enterprise', 1999, -1, -1, -1, '{"pos": true, "reports": true, "api": true, "priority_support": true}', 4)
ON CONFLICT (name) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_organizations_subscription ON organizations(subscription_plan, subscription_status);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, start_date, end_date);

-- Comments
COMMENT ON COLUMN profiles.is_super_admin IS 'ผู้ดูแลระบบ SaaS (เจ้าของโปรแกรม)';
COMMENT ON COLUMN organizations.subscription_plan IS 'แพ็กเกจที่ใช้งาน';
COMMENT ON COLUMN organizations.is_blocked IS 'ถูกบล็อกหรือไม่';
COMMENT ON TABLE announcements IS 'ประกาศจากผู้ดูแลระบบ';
COMMENT ON TABLE subscription_plans IS 'แพ็กเกจ Subscription';

-- ==========================================
-- SUPER ADMIN RLS POLICIES (CRITICAL)
-- ==========================================

-- 1. Profiles: Ensure Super Admin can see ALL profiles
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON profiles;
CREATE POLICY "Super Admin View All Profiles" ON profiles
FOR SELECT USING (
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = TRUE
);

-- 2. Organizations: Ensure Super Admin can see ALL organizations
DROP POLICY IF EXISTS "Super Admin View All Organizations" ON organizations;
CREATE POLICY "Super Admin View All Organizations" ON organizations
FOR ALL USING (
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = TRUE
);

-- 3. Allow Super Admin to bypass Check Constraints if needed (optional, handled by App logic)
-- Note: Subscriptions and detailed management usually handled via service role or these policies.

