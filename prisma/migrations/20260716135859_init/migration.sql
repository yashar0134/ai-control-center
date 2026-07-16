-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "collectionMethod" TEXT NOT NULL,
    "privacyNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Capability" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "connectionId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "Capability_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "eventType" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "costAmount" REAL,
    "costKind" TEXT,
    "provenance" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "connectionId" TEXT,
    "status" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "metricsJson" TEXT,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthSnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectorId" TEXT NOT NULL,
    "connectionId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "observationsWritten" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    CONSTRAINT "CollectorRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "detailsJson" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Capability_connectionId_capability_key" ON "Capability"("connectionId", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_dedupeKey_key" ON "UsageEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "UsageEvent_connectionId_occurredAt_idx" ON "UsageEvent"("connectionId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_occurredAt_idx" ON "UsageEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CostRecord_dedupeKey_key" ON "CostRecord"("dedupeKey");

-- CreateIndex
CREATE INDEX "CostRecord_connectionId_periodStart_idx" ON "CostRecord"("connectionId", "periodStart");

-- CreateIndex
CREATE INDEX "CostRecord_periodStart_idx" ON "CostRecord"("periodStart");

-- CreateIndex
CREATE INDEX "HealthSnapshot_subjectType_subjectId_capturedAt_idx" ON "HealthSnapshot"("subjectType", "subjectId", "capturedAt");

-- CreateIndex
CREATE INDEX "CollectorRun_collectorId_startedAt_idx" ON "CollectorRun"("collectorId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");
