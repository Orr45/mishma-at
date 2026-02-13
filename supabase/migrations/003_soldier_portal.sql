-- Add source column to events table to distinguish commander vs soldier created events
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'commander' CHECK (source IN ('commander', 'soldier'));

-- Make creator_id nullable so soldiers (who don't have auth accounts) can create events
ALTER TABLE events ALTER COLUMN creator_id DROP NOT NULL;
