-- Fix dive site image entityType: underscore → hyphen
-- The seed data incorrectly used 'dive_site' but all app routes query for 'dive-site'
UPDATE images SET entity_type = 'dive-site' WHERE entity_type = 'dive_site';
