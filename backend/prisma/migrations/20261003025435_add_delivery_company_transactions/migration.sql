-- CreateEnum
CREATE TYPE "DeliveryCompanyTransactionDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "DeliveryCompanyTransactionSource" AS ENUM ('stripe_payment', 'stripe_transfer', 'refund', 'adjustment');

-- AlterTable
ALTER TABLE "D_Company" ALTER COLUMN "balance" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "delivery_company_transactions" (
    "id" UUID NOT NULL,
    "delivery_company_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'egp',
    "direction" "DeliveryCompanyTransactionDirection" NOT NULL,
    "source" "DeliveryCompanyTransactionSource" NOT NULL,
    "stripe_reference_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_company_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_company_transactions_stripe_reference_id_key" ON "delivery_company_transactions"("stripe_reference_id");

-- CreateIndex
CREATE INDEX "delivery_company_transactions_delivery_company_id_created_a_idx" ON "delivery_company_transactions"("delivery_company_id", "created_at");

-- AddForeignKey
ALTER TABLE "delivery_company_transactions" ADD CONSTRAINT "delivery_company_transactions_delivery_company_id_fkey" FOREIGN KEY ("delivery_company_id") REFERENCES "D_Company"("deliveryCompany") ON DELETE RESTRICT ON UPDATE CASCADE;
