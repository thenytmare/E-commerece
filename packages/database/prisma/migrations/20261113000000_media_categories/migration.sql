ALTER TABLE "media_library" ADD COLUMN "category_id" TEXT;
CREATE INDEX "media_library_category_id_idx" ON "media_library"("category_id");
ALTER TABLE "media_library" ADD CONSTRAINT "media_library_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
