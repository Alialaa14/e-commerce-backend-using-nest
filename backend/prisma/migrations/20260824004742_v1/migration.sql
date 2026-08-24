/*
  Warnings:

  - You are about to drop the column `cartId` on the `variants` table. All the data in the column will be lost.
  - Made the column `sold` on table `variants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isDeleted` on table `variants` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "variants" DROP CONSTRAINT "variants_cartId_fkey";

-- DropIndex
DROP INDEX "variants_cartId_key";

-- AlterTable
ALTER TABLE "variants" DROP COLUMN "cartId",
ALTER COLUMN "sold" SET NOT NULL,
ALTER COLUMN "isDeleted" SET NOT NULL;

-- CreateTable
CREATE TABLE "cart_products" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cart_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_products_cartId_variantId_key" ON "cart_products"("cartId", "variantId");

-- AddForeignKey
ALTER TABLE "cart_products" ADD CONSTRAINT "cart_products_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_products" ADD CONSTRAINT "cart_products_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
