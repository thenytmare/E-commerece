ALTER TABLE "orders" ADD COLUMN "source_cart_id" TEXT, ADD COLUMN "cart_restored_at" TIMESTAMP(3);
CREATE INDEX "orders_source_cart_id_idx" ON "orders"("source_cart_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_source_cart_id_fkey" FOREIGN KEY ("source_cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
