ALTER TABLE "Cart"
  ADD COLUMN "brand_id" UUID;

CREATE INDEX "Cart_brand_id_idx" ON "Cart"("brand_id");

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
