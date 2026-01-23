CREATE TABLE saved_listings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved listings" ON saved_listings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can save listings" ON saved_listings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can unsave listings" ON saved_listings
  FOR DELETE TO authenticated
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_saved_listings_user ON saved_listings(user_id);
