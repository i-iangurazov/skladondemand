-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'PDF');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PARSED', 'COMMITTED', 'FAILED', 'UNDONE');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('READY', 'ERROR', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL,
    "checksum" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "totals" JSONB,
    "reportJson" JSONB,
    "warnings" JSONB,
    "mapping" JSONB,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "sku" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "errors" JSONB,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "importJobId" TEXT,

    CONSTRAINT "ImportAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_createdByUserId_createdAt_idx" ON "ImportJob"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_importJobId_rowIndex_idx" ON "ImportRow"("importJobId", "rowIndex");

-- CreateIndex
CREATE INDEX "ImportRow_sku_idx" ON "ImportRow"("sku");

-- CreateIndex
CREATE INDEX "ImportAuditLog_userId_createdAt_idx" ON "ImportAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportAuditLog_importJobId_idx" ON "ImportAuditLog"("importJobId");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAuditLog" ADD CONSTRAINT "ImportAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAuditLog" ADD CONSTRAINT "ImportAuditLog_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
