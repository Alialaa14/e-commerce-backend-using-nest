ALTER TABLE "D_Company"
ADD COLUMN "owner_user_id" UUID;

CREATE UNIQUE INDEX "D_Company_owner_user_id_key"
ON "D_Company"("owner_user_id");

ALTER TABLE "D_Company"
ADD CONSTRAINT "D_Company_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Courier"
ADD COLUMN "user_id" UUID,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Courier_user_id_key"
ON "Courier"("user_id");

CREATE INDEX "Courier_deliveryCompanyId_is_active_idx"
ON "Courier"("deliveryCompanyId", "is_active");

ALTER TABLE "Courier"
ADD CONSTRAINT "Courier_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "staff_invitations"
ADD COLUMN "delivery_company_id" UUID,
ADD COLUMN "courier_profile" JSONB;

CREATE INDEX "staff_invitations_delivery_company_id_role_expires_at_idx"
ON "staff_invitations"("delivery_company_id", "role", "expires_at");

ALTER TABLE "staff_invitations"
ADD CONSTRAINT "staff_invitations_delivery_company_id_fkey"
FOREIGN KEY ("delivery_company_id") REFERENCES "D_Company"("deliveryCompany")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BranchOrder_deliveryCompanyId_status_idx"
ON "BranchOrder"("deliveryCompanyId", "status");

CREATE INDEX "BranchOrder_courierId_status_idx"
ON "BranchOrder"("courierId", "status");

CREATE TABLE "BranchOrderStatusHistory" (
  "id" UUID NOT NULL,
  "branchOrderId" UUID NOT NULL,
  "fromStatus" "orderStatus",
  "toStatus" "orderStatus" NOT NULL,
  "changedByUserId" UUID NOT NULL,
  "changedByRole" "Role" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BranchOrderStatusHistory_branchOrderId_createdAt_idx"
ON "BranchOrderStatusHistory"("branchOrderId", "createdAt");

CREATE INDEX "BranchOrderStatusHistory_changedByUserId_createdAt_idx"
ON "BranchOrderStatusHistory"("changedByUserId", "createdAt");

ALTER TABLE "BranchOrderStatusHistory"
ADD CONSTRAINT "BranchOrderStatusHistory_branchOrderId_fkey"
FOREIGN KEY ("branchOrderId") REFERENCES "BranchOrder"("branchOrderId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BranchOrderStatusHistory"
ADD CONSTRAINT "BranchOrderStatusHistory_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DeliveryProof" (
  "id" UUID NOT NULL,
  "branchOrderId" UUID NOT NULL,
  "courierId" UUID NOT NULL,
  "proofUrl" TEXT NOT NULL,
  "proofStorageId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryProof_branchOrderId_createdAt_idx"
ON "DeliveryProof"("branchOrderId", "createdAt");

CREATE INDEX "DeliveryProof_courierId_createdAt_idx"
ON "DeliveryProof"("courierId", "createdAt");

ALTER TABLE "DeliveryProof"
ADD CONSTRAINT "DeliveryProof_branchOrderId_fkey"
FOREIGN KEY ("branchOrderId") REFERENCES "BranchOrder"("branchOrderId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryProof"
ADD CONSTRAINT "DeliveryProof_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "Courier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
