-- ============================================
-- News / Announcements System
-- ============================================

CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  platoon_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_platoon ON news(platoon_id);
CREATE INDEX idx_news_created_at ON news(created_at DESC);

-- RLS disabled (consistent with other tables)
ALTER TABLE news DISABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE news;
