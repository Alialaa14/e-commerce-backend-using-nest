-- Add product soft-delete state without removing historical rows
ALTER TABLE "products"
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "products_isDeleted_idx" ON "products"("isDeleted");
