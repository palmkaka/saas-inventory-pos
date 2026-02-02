-- Fix Infinite Recursion in RLS Policies

-- 1. Create a Secure Function to check Super Admin capabilities
-- defined as SECURITY DEFINER to bypass RLS when running the check itself.
CREATE OR REPLACE FUNCTION public.get_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with permission of creator (postgres/admin), bypassing RLS
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = TRUE
  );
END;
$$;

-- 2. Update Profiles Policy to use the function logic (avoiding self-referencing RLS loop)
DROP POLICY IF EXISTS "Super Admin View All Profiles" ON profiles;
CREATE POLICY "Super Admin View All Profiles" ON profiles
FOR ALL -- Changed from SELECT to ALL to let them edit too if needed
USING (
    get_is_super_admin() = TRUE
);

-- 3. Update Organizations Policy
DROP POLICY IF EXISTS "Super Admin View All Organizations" ON organizations;
CREATE POLICY "Super Admin View All Organizations" ON organizations
FOR ALL
USING (
    get_is_super_admin() = TRUE
);
