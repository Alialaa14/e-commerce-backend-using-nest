/*
  Warnings:

  - The primary key for the `cart_products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `cart_products` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "cart_products_cartId_variantId_key";

-- AlterTable
ALTER TABLE "cart_products" DROP CONSTRAINT "cart_products_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "cart_products_pkey" PRIMARY KEY ("cartId", "variantId");
