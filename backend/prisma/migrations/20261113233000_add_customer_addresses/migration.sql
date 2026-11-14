CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "governorate" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "building" TEXT,
    "apartment" TEXT,
    "landmark" TEXT,
    "address_text" TEXT NOT NULL,
    "contact_phone" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "addresses_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "addresses_user_id_is_default_updated_at_idx"
    ON "addresses"("user_id", "is_default", "updated_at");

CREATE UNIQUE INDEX "addresses_one_default_per_user_idx"
    ON "addresses"("user_id")
    WHERE "is_default" = true;
