CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transaction_id, reviewer_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone" ON reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create reviews for their transactions" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    seller_rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE reviewee_id = NEW.reviewee_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = NEW.reviewee_id)
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_after_review
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_seller_rating();
