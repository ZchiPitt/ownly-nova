-- Migration: Create marketplace listings, transactions, and messages tables
-- Description: Adds marketplace schema with RLS policies and indexes.
-- Created: 2026-01-31

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'reserved', 'removed')),
    price decimal(10, 2),
    price_type text NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable', 'free')),
    condition text NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    description text,
    view_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
    agreed_price decimal(10, 2),
    message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
    sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS listings_seller_status_idx ON listings(seller_id, status);
CREATE INDEX IF NOT EXISTS listings_item_id_idx ON listings(item_id);
CREATE INDEX IF NOT EXISTS transactions_buyer_id_idx ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS transactions_seller_id_idx ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS transactions_listing_id_idx ON transactions(listing_id);
CREATE INDEX IF NOT EXISTS messages_listing_id_idx ON messages(listing_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Listings policies
CREATE POLICY "Listings are viewable by authenticated users"
    ON listings
    FOR SELECT
    TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create listings for their items"
    ON listings
    FOR INSERT
    TO authenticated
    WITH CHECK (seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sellers can update their own listings"
    ON listings
    FOR UPDATE
    TO authenticated
    USING (seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    WITH CHECK (seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sellers can delete their own listings"
    ON listings
    FOR DELETE
    TO authenticated
    USING (seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Transactions policies
CREATE POLICY "Users can view their own transactions"
    ON transactions
    FOR SELECT
    TO authenticated
    USING (
        buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
            SELECT 1
            FROM listings
            WHERE listings.id = transactions.listing_id
              AND listings.seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Buyers can create transactions"
    ON transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Participants can update transactions"
    ON transactions
    FOR UPDATE
    TO authenticated
    USING (
        buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
            SELECT 1
            FROM listings
            WHERE listings.id = transactions.listing_id
              AND listings.seller_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Messages policies
CREATE POLICY "Users can view their own messages"
    ON messages
    FOR SELECT
    TO authenticated
    USING (
        sender_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR receiver_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can send messages"
    ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their sent messages"
    ON messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR receiver_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    );

-- Apply updated_at triggers
CREATE TRIGGER listings_updated_at_trigger
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER transactions_updated_at_trigger
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
