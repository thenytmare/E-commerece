-- Guests can save products too. A guest's saved item has session_id (the
-- guest cart cookie) instead of user_id, and moves to the account at sign-in.
ALTER TABLE "wishlist_items" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "wishlist_items" ADD COLUMN "session_id" TEXT;
CREATE INDEX "wishlist_items_session_id_idx" ON "wishlist_items"("session_id");
CREATE INDEX "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");
