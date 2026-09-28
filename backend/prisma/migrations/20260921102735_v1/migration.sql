/*
  Warnings:

  - A unique constraint covering the columns `[provider,id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,providerCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Providers" AS ENUM ('paymob', 'stripe');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "provider" "Providers",
ADD COLUMN     "providerCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_id_key" ON "User"("provider", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerCustomerId_key" ON "User"("provider", "providerCustomerId");
