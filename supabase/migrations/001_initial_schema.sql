-- ============================================
-- Mishma'at - Soldier Management System
-- Initial Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('PC', 'SGT', 'SL');
-- PC = Platoon Commander (מ"פ)
-- SGT = Sergeant (סמל)
-- SL = Squad Leader (מ"כ)

CREATE TYPE soldier_status AS ENUM ('Base', 'Home');

CREATE TYPE event_category AS ENUM ('HR/Logistics', 'Medical', 'Leaves', 'Personal');
-- HR/Logistics = שלישות
-- Medical = רפואה
-- Leaves = יציאות
-- Personal = אישי

-- ============================================
-- TABLES
-- ============================================

-- Profiles: extends Supabase auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'SL',
  platoon_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Soldiers
CREATE TABLE soldiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  role_in_unit TEXT,
  weapon_serial TEXT,
  civilian_job TEXT,
  status soldier_status NOT NULL DEFAULT 'Base',
  notes TEXT,
  platoon_id TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  soldier_id UUID REFERENCES soldiers(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id),
  description TEXT NOT NULL,
  category event_category NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklists
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  platoon_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist completions
CREATE TABLE checklist_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  soldier_id UUID NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(checklist_id, soldier_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_soldiers_platoon ON soldiers(platoon_id);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_events_soldier ON events(soldier_id);
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_checklists_platoon ON checklists(platoon_id);
CREATE INDEX idx_checklist_completions_checklist ON checklist_completions(checklist_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles in their platoon, update only their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view platoon profiles"
  ON profiles FOR SELECT
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Soldiers: scoped to platoon
CREATE POLICY "Users can view soldiers in their platoon"
  ON soldiers FOR SELECT
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert soldiers in their platoon"
  ON soldiers FOR INSERT
  WITH CHECK (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update soldiers in their platoon"
  ON soldiers FOR UPDATE
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete soldiers in their platoon"
  ON soldiers FOR DELETE
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

-- Events: scoped to platoon via soldiers or creator
CREATE POLICY "Users can view events in their platoon"
  ON events FOR SELECT
  USING (
    creator_id IN (SELECT id FROM profiles WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()))
    OR soldier_id IN (SELECT id FROM soldiers WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()))
  );

CREATE POLICY "Users can create events"
  ON events FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  USING (creator_id = auth.uid());

-- Checklists: scoped to platoon
CREATE POLICY "Users can view checklists in their platoon"
  ON checklists FOR SELECT
  USING (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create checklists in their platoon"
  ON checklists FOR INSERT
  WITH CHECK (platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own checklists"
  ON checklists FOR DELETE
  USING (created_by = auth.uid());

-- Checklist completions: scoped via checklist's platoon
CREATE POLICY "Users can view completions in their platoon"
  ON checklist_completions FOR SELECT
  USING (
    checklist_id IN (
      SELECT id FROM checklists
      WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can mark completions"
  ON checklist_completions FOR INSERT
  WITH CHECK (
    checklist_id IN (
      SELECT id FROM checklists
      WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can remove completions"
  ON checklist_completions FOR DELETE
  USING (
    checklist_id IN (
      SELECT id FROM checklists
      WHERE platoon_id = (SELECT platoon_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, platoon_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'SL'),
    COALESCE(NEW.raw_user_meta_data->>'platoon_id', 'default')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- REALTIME: Enable for live updates
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE soldiers;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_completions;
