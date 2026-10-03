/*
  Warnings:

  - Added the required column `deliveryPrice` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BrandTransactionDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "BrandTransactionSource" AS ENUM ('stripe_payment', 'stripe_transfer', 'refund', 'adjustment');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryPrice" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "brand_transactions" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'egp',
    "direction" "BrandTransactionDirection" NOT NULL,
    "source" "BrandTransactionSource" NOT NULL,
    "stripe_reference_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_transactions_stripe_reference_id_key" ON "brand_transactions"("stripe_reference_id");

-- CreateIndex
CREATE INDEX "brand_transactions_brand_id_created_at_idx" ON "brand_transactions"("brand_id", "created_at");

-- AddForeignKey
ALTER TABLE "brand_transactions" ADD CONSTRAINT "brand_transactions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
