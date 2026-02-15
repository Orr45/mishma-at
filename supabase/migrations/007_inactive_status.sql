-- Allow 'Inactive' status for soldiers not in active duty
-- The status column is TEXT with a CHECK constraint, so we need to update it
ALTER TABLE soldiers DROP CONSTRAINT IF EXISTS soldiers_status_check;
ALTER TABLE soldiers ADD CONSTRAINT soldiers_status_check CHECK (status IN ('Base', 'Home', 'Inactive'));
