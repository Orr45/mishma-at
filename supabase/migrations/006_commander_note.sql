-- Add commander_note column to events
-- Allows commanders to reply to soldier event requests
ALTER TABLE events ADD COLUMN IF NOT EXISTS commander_note TEXT;
