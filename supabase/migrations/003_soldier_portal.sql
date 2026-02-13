-- Add source column to events table to distinguish commander vs soldier created events
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'commander' CHECK (source IN ('commander', 'soldier'));

-- Make creator_id nullable so soldiers (who don't have auth accounts) can create events
ALTER TABLE events ALTER COLUMN creator_id DROP NOT NULL;

-- ============================================
-- RLS POLICIES for Soldier Portal (anonymous access)
-- ============================================

-- Allow anonymous users to read a specific soldier by ID (for the portal page)
CREATE POLICY "Anyone can view soldier by id"
  ON soldiers FOR SELECT
  USING (true);

-- Allow anonymous users to read events for a specific soldier
CREATE POLICY "Anyone can view events by soldier_id"
  ON events FOR SELECT
  USING (true);

-- Allow anonymous users to insert events with source='soldier'
CREATE POLICY "Soldiers can create event requests"
  ON events FOR INSERT
  WITH CHECK (source = 'soldier' AND creator_id IS NULL);

-- Allow commanders to update events (for ending events, etc.)
CREATE POLICY "Users can update events in their platoon"
  ON events FOR UPDATE
  USING (
    creator_id = auth.uid()
    OR soldier_id IN (SELECT id FROM soldiers WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()))
  );
