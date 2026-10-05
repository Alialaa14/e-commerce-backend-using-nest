-- Extend existing roles without removing values used by current endpoints.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BRAND_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOMER';

CREATE TYPE "product_status" AS ENUM ('draft', 'pending', 'active', 'archived');

-- Brand slugs are generated with an id suffix so existing duplicate names remain unique.
ALTER TABLE "brands"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "description" TEXT;

UPDATE "brands"
SET "slug" =
  COALESCE(
    NULLIF(trim(BOTH '-' FROM lower(regexp_replace("brand_name", '[^a-zA-Z0-9]+', '-', 'g'))), ''),
    'brand'
  ) || '-' || replace("id"::text, '-', '');

ALTER TABLE "brands"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- Existing branches receive deterministic codes; nullable names are made usable.
ALTER TABLE "brand_branches"
  ADD COLUMN "branch_code" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "opening_hours" JSONB,
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

UPDATE "brand_branches"
SET "branch_code" = 'BR-' || replace("id"::text, '-', ''),
    "branch_name" = COALESCE("branch_name", 'Branch ' || left(replace("id"::text, '-', ''), 8));

ALTER TABLE "brand_branches"
  ALTER COLUMN "branch_code" SET NOT NULL,
  ALTER COLUMN "branch_name" SET NOT NULL;

CREATE UNIQUE INDEX "brand_branches_brand_id_branch_code_key"
  ON "brand_branches"("brand_id", "branch_code");

-- Existing products get stable unique slugs and retain their current visibility.
ALTER TABLE "products"
  ADD COLUMN "branch_id" UUID,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "status" "product_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

UPDATE "products"
SET "slug" =
      COALESCE(
        NULLIF(trim(BOTH '-' FROM lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''),
        'product'
      ) || '-' || replace("id"::text, '-', ''),
    "status" = CASE
      WHEN "available" AND NOT "isDeleted" THEN 'active'::"product_status"
      ELSE 'archived'::"product_status"
    END,
    "deleted_at" = CASE
      WHEN "isDeleted" THEN CURRENT_TIMESTAMP
      ELSE NULL
    END;

ALTER TABLE "products"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "products_brand_id_slug_key" ON "products"("brand_id", "slug");
CREATE INDEX "products_brand_id_status_idx" ON "products"("brand_id", "status");
CREATE INDEX "products_branch_id_idx" ON "products"("branch_id");

-- Preserve legacy variant columns while initializing the shared catalog fields.
ALTER TABLE "variants"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "base_price" DECIMAL(10, 2),
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "options" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

UPDATE "variants" AS v
SET "sku" = 'SKU-' || replace(v."id"::text, '-', ''),
    "base_price" = p."price"::DECIMAL(10, 2),
    "options" = jsonb_build_object('color', v."color", 'size', v."size"),
    "is_active" = NOT v."isDeleted",
    "deleted_at" = CASE
      WHEN v."isDeleted" THEN CURRENT_TIMESTAMP
      ELSE NULL
    END
FROM "products" AS p
WHERE p."id" = v."product_id";

ALTER TABLE "variants"
  ALTER COLUMN "sku" SET NOT NULL,
  ALTER COLUMN "base_price" SET NOT NULL;

CREATE UNIQUE INDEX "variants_sku_key" ON "variants"("sku");
CREATE INDEX "variants_product_id_idx" ON "variants"("product_id");

-- Add tenant assignments and backfill existing brand owners.
ALTER TABLE "User"
  ADD COLUMN "brand_id" UUID,
  ADD COLUMN "branch_id" UUID;

UPDATE "User" AS u
SET "brand_id" = b."id"
FROM "brands" AS b
WHERE b."user_id" = u."id";

CREATE INDEX "User_brand_id_idx" ON "User"("brand_id");
CREATE INDEX "User_branch_id_idx" ON "User"("branch_id");

-- Historical carts and orders remain unassigned because their former data
-- does not identify a specific branch.
ALTER TABLE "Cart"
  ADD COLUMN "branch_id" UUID;

ALTER TABLE "Order"
  ADD COLUMN "branch_id" UUID;

CREATE INDEX "Cart_branch_id_idx" ON "Cart"("branch_id");
CREATE INDEX "Order_branch_id_idx" ON "Order"("branch_id");

CREATE TABLE "branch_variants" (
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "price" DECIMAL(10, 2),
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "branch_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branch_variants_stock_quantity_check" CHECK ("stock_quantity" >= 0),
  CONSTRAINT "branch_variants_reserved_quantity_check" CHECK ("reserved_quantity" >= 0)
);

CREATE UNIQUE INDEX "branch_variants_branch_id_variant_id_key"
  ON "branch_variants"("branch_id", "variant_id");
CREATE INDEX "branch_variants_variant_id_idx"
  ON "branch_variants"("variant_id");

-- Move existing global stock to the active main branch where one exists.
-- Legacy Variant.stock remains unchanged for compatibility and auditability.
INSERT INTO "branch_variants" (
  "id",
  "branch_id",
  "variant_id",
  "price",
  "stock_quantity",
  "reserved_quantity",
  "is_available",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  main_branch."id",
  v."id",
  NULL,
  GREATEST(v."stock", 0),
  0,
  p."available" AND NOT p."isDeleted" AND NOT v."isDeleted",
  CURRENT_TIMESTAMP
FROM "variants" AS v
JOIN "products" AS p ON p."id" = v."product_id"
JOIN LATERAL (
  SELECT b."id"
  FROM "brand_branches" AS b
  WHERE b."brand_id" = p."brand_id"
    AND b."is_active" = TRUE
    AND b."is_main" = TRUE
    AND b."deleted_at" IS NULL
  ORDER BY b."created_at", b."id"
  LIMIT 1
) AS main_branch ON TRUE;

CREATE TABLE "order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "name_snapshot" TEXT NOT NULL,
  "sku_snapshot" TEXT NOT NULL,
  "price_snapshot" DECIMAL(10, 2) NOT NULL,
  "quantity" INTEGER NOT NULL,

  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "User_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "branch_variants"
  ADD CONSTRAINT "branch_variants_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "branch_variants_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "Order"("orderId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "variants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
