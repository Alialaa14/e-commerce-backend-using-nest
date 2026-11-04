CREATE TYPE "checkout_payment_status" AS ENUM (
    'unpaid',
    'pending',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
);

ALTER TYPE "checkout_status" ADD VALUE 'payment_pending';
ALTER TYPE "checkout_status" ADD VALUE 'payment_failed';

ALTER TABLE "checkout_sessions"
ADD COLUMN "payment_status" "checkout_payment_status" NOT NULL DEFAULT 'unpaid',
ADD COLUMN "stripe_session_id" TEXT,
ADD COLUMN "stripe_payment_intent_id" TEXT,
ADD COLUMN "payment_attempt" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "checkout_sessions_stripe_session_id_key"
ON "checkout_sessions"("stripe_session_id");

CREATE UNIQUE INDEX "checkout_sessions_stripe_payment_intent_id_key"
ON "checkout_sessions"("stripe_payment_intent_id");
