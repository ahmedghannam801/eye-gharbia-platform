-- ==============================================================================
-- CLEANUP EXECUTIVE ROLES COMMITTEE & DEPARTMENT
-- Ensures Super Admin, Coordinator, and Deputy Coordinator have 'None' committee
-- and 'Executive' department in the database profiles table.
-- ==============================================================================

UPDATE profiles
SET 
  committee = 'None',
  department = 'Executive'
WHERE role IN ('Super Admin', 'Coordinator', 'Deputy Coordinator');

-- Optional: Verify the updated rows
SELECT id, full_name, email, role, committee, department, status
FROM profiles
WHERE role IN ('Super Admin', 'Coordinator', 'Deputy Coordinator');
