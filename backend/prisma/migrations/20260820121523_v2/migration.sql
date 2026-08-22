-- DropForeignKey
ALTER TABLE "variants" DROP CONSTRAINT "variants_cartId_fkey";

-- AlterTable
ALTER TABLE "variants" ADD COLUMN     "isDeleted" BOOLEAN DEFAULT false,
ALTER COLUMN "sold" DROP NOT NULL,
ALTER COLUMN "cartId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
