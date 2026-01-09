-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "title" TEXT,
    "activeKey" TEXT NOT NULL DEFAULT 'CONTEXT'
);

-- CreateTable
CREATE TABLE "SectionAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "qaJson" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "SectionAnswer_sessionId_key_idx" ON "SectionAnswer"("sessionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SectionAnswer_sessionId_key_key" ON "SectionAnswer"("sessionId", "key");

-- CreateIndex
CREATE INDEX "SectionSummary_sessionId_key_idx" ON "SectionSummary"("sessionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SectionSummary_sessionId_key_key" ON "SectionSummary"("sessionId", "key");

-- CreateIndex
CREATE INDEX "Artifact_sessionId_type_idx" ON "Artifact"("sessionId", "type");
