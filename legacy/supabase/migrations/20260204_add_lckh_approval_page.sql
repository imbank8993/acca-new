-- Add LCKH Approval page to navigation menu
-- Date: 2026-02-04

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS master_permissions_list (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Add permission for LCKH Approval page
INSERT INTO master_permissions_list (category, resource, action, label, description) VALUES
('LCKH Approval', 'lckh_approval', 'view', 'View LCKH Approval', 'Melihat halaman approval LCKH (Waka/Kamad)')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant permission to ADMIN
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('ADMIN', 'lckh_approval', 'view', true)
ON CONFLICT (role_name, resource, action) DO UPDATE SET is_allowed = true;

-- Grant permission to WAKA role (if exists)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('WAKA', 'lckh_approval', 'view', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Grant permission to KAMAD role (if exists)
INSERT INTO role_permissions (role_name, resource, action, is_allowed) VALUES
('KAMAD', 'lckh_approval', 'view', true)
ON CONFLICT (role_name, resource, action) DO NOTHING;

-- Add lckh-approval page to navigation for users with ADMIN, WAKA, or KAMAD roles
-- This adds "Approval LCKH=lckh-approval" after the existing lckh page
UPDATE users 
SET pages = 
    CASE 
        -- If pages already contains 'lckh-approval', don't add it again
        WHEN pages LIKE '%lckh-approval%' THEN pages
        -- If pages contains 'lckh' but not 'lckh-approval', add it after lckh
        WHEN pages LIKE '%lckh%' THEN 
            REPLACE(pages, 'lckh', 'lckh,Approval LCKH=lckh-approval')
        -- Otherwise, just append it at the end
        ELSE pages || ',Approval LCKH=lckh-approval'
    END
WHERE (
    role ILIKE '%ADMIN%' OR 
    role ILIKE '%WAKA%' OR 
    role ILIKE '%KAMAD%'
)
AND pages IS NOT NULL
AND pages != '';
