CREATE TYPE "BranchRole" AS ENUM ('manager', 'sales');

CREATE TABLE "branch_staff" (
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "BranchRole" NOT NULL DEFAULT 'sales',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_staff_pkey" PRIMARY KEY ("branch_id", "user_id"),
    CONSTRAINT "branch_staff_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "branch_staff_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "branch_staff_user_id_idx" ON "branch_staff"("user_id");
CREATE INDEX "branch_staff_branch_id_role_idx" ON "branch_staff"("branch_id", "role");

UPDATE "User" AS staff
SET "brand_id" = branch."brand_id"
FROM "brand_branches" AS branch
WHERE staff."branch_id" = branch."id"
  AND staff."brand_id" IS NULL
  AND staff."role" IN ('BRANCH_MANAGER', 'Branch_Sales');

INSERT INTO "branch_staff" ("branch_id", "user_id", "role")
SELECT
    "branch_id",
    "id",
    CASE
        WHEN "role" = 'BRANCH_MANAGER' THEN 'manager'::"BranchRole"
        ELSE 'sales'::"BranchRole"
    END
FROM "User"
WHERE "role" IN ('BRANCH_MANAGER', 'Branch_Sales')
  AND "branch_id" IS NOT NULL
ON CONFLICT ("branch_id", "user_id") DO NOTHING;

CREATE TABLE "staff_invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "brand_id" UUID,
    "branch_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_invitations_brand_id_fkey"
        FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_invitations_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "brand_branches"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_invitations_created_by_id_fkey"
        FOREIGN KEY ("created_by_id") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "staff_invitations_token_hash_key"
    ON "staff_invitations"("token_hash");
CREATE INDEX "staff_invitations_email_role_expires_at_idx"
    ON "staff_invitations"("email", "role", "expires_at");
CREATE INDEX "staff_invitations_brand_id_branch_id_role_idx"
    ON "staff_invitations"("brand_id", "branch_id", "role");
CREATE UNIQUE INDEX "staff_invitations_active_scope_key"
    ON "staff_invitations"(
        lower("email"),
        "role",
        COALESCE("brand_id", '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
