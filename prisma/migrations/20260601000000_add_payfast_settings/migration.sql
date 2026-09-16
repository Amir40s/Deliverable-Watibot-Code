ALTER TABLE "SystemConfig"
ADD COLUMN IF NOT EXISTS "payfastEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "payfastMerchantId" TEXT,
ADD COLUMN IF NOT EXISTS "payfastMerchantName" TEXT,
ADD COLUMN IF NOT EXISTS "payfastSecuredKey" TEXT,
ADD COLUMN IF NOT EXISTS "payfastEnvironment" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS "payfastTokenUrl" TEXT,
ADD COLUMN IF NOT EXISTS "payfastCheckoutUrl" TEXT,
ADD COLUMN IF NOT EXISTS "payfastCurrencyCode" TEXT DEFAULT 'PKR',
ADD COLUMN IF NOT EXISTS "payfastStoreId" TEXT,
ADD COLUMN IF NOT EXISTS "payfastDefaultCustomerMobile" TEXT;

CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "basketId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "planSlug" TEXT NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PKR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "gatewayTransactionId" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_basketId_key" ON "PaymentTransaction"("basketId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_organizationId_idx" ON "PaymentTransaction"("organizationId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
