-- Add source_batch_id to track multi-item photo batches
ALTER TABLE items
ADD COLUMN source_batch_id UUID;
