-- CreateTable
CREATE TABLE "AIFunction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "flowId" TEXT,
    "finalMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMcpServer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "accessToken" TEXT,
    "apiKey" TEXT,
    "customHeaders" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIMcpServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIFunction_organizationId_idx" ON "AIFunction"("organizationId");

-- CreateIndex
CREATE INDEX "AIFunction_aiAgentId_idx" ON "AIFunction"("aiAgentId");

-- CreateIndex
CREATE INDEX "AIFunction_flowId_idx" ON "AIFunction"("flowId");

-- CreateIndex
CREATE INDEX "AIFunction_isActive_idx" ON "AIFunction"("isActive");

-- CreateIndex
CREATE INDEX "AIMcpServer_organizationId_idx" ON "AIMcpServer"("organizationId");

-- CreateIndex
CREATE INDEX "AIMcpServer_aiAgentId_idx" ON "AIMcpServer"("aiAgentId");

-- CreateIndex
CREATE INDEX "AIMcpServer_isActive_idx" ON "AIMcpServer"("isActive");

-- AddForeignKey
ALTER TABLE "AIFunction" ADD CONSTRAINT "AIFunction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFunction" ADD CONSTRAINT "AIFunction_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AIAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFunction" ADD CONSTRAINT "AIFunction_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMcpServer" ADD CONSTRAINT "AIMcpServer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMcpServer" ADD CONSTRAINT "AIMcpServer_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AIAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
