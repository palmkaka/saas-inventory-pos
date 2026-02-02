-- Fix user branch assignment: Assign user to the main branch if not assigned
-- This fixes the "Unknown Branch" issue in the dashboard

DO $$
DECLARE
  target_org_id UUID;
  main_branch_id UUID;
  user_id UUID;
BEGIN
  -- 1. Get current user ID (Dynamic in real execution, here we iterate or update all)
  
  -- Update all profiles that have organization but no branch
  FOR user_id IN SELECT id FROM profiles WHERE organization_id IS NOT NULL AND branch_id IS NULL
  LOOP
    -- Get organization id
    SELECT organization_id INTO target_org_id FROM profiles WHERE id = user_id;
    
    -- Find main branch for this org
    SELECT id INTO main_branch_id FROM branches WHERE organization_id = target_org_id AND is_main = TRUE LIMIT 1;
    
    -- If no main branch exists, create one!
    IF main_branch_id IS NULL THEN
        INSERT INTO branches (organization_id, name, code, is_main)
        VALUES (target_org_id, 'สำนักงานใหญ่ (Headquarters)', 'HQ', TRUE)
        RETURNING id INTO main_branch_id;
    END IF;
    
    -- Update profile
    UPDATE profiles SET branch_id = main_branch_id WHERE id = user_id;
  END LOOP;
  
END $$;
