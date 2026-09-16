-- CreateTable
CREATE TABLE "WelcomeMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "conditionLogic" TEXT NOT NULL DEFAULT 'OR',
    "triggerLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelcomeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WelcomeMessage_organizationId_idx" ON "WelcomeMessage"("organizationId");
CREATE INDEX "WelcomeMessage_isActive_idx" ON "WelcomeMessage"("isActive");

-- AddForeignKey
ALTER TABLE "WelcomeMessage" ADD CONSTRAINT "WelcomeMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
