-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "agentId" TEXT NOT NULL DEFAULT 'main',
    "model" TEXT,
    "workingPath" TEXT,
    "sessionFile" TEXT,
    "planModeState" TEXT,
    "pendingQuestion" TEXT,
    "modifiedFiles" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "emoji" TEXT,
    "vibe" TEXT,
    "avatar" TEXT,
    "defaultModel" TEXT,
    "thinkingLevel" TEXT,
    "workspacePath" TEXT,
    "heartbeatEvery" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "thinkingLevel" TEXT NOT NULL DEFAULT 'medium',
    "activeThemeId" TEXT NOT NULL DEFAULT 'default-dark'
);

-- CreateTable
CREATE TABLE "CustomProvider" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "api" TEXT,
    "headers" TEXT
);

-- CreateTable
CREATE TABLE "CustomModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reasoning" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER NOT NULL DEFAULT 128000,
    "maxTokens" INTEGER NOT NULL DEFAULT 8192,
    "costInput" REAL NOT NULL DEFAULT 0,
    "costOutput" REAL NOT NULL DEFAULT 0,
    "costCacheRead" REAL NOT NULL DEFAULT 0,
    "costCacheWrite" REAL NOT NULL DEFAULT 0,
    "providerName" TEXT NOT NULL,
    CONSTRAINT "CustomModel_providerName_fkey" FOREIGN KEY ("providerName") REFERENCES "CustomProvider" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomTheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "colors" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'main',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deleteAfterRun" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Session_agentId_idx" ON "Session"("agentId");

-- CreateIndex
CREATE INDEX "Agent_isDefault_idx" ON "Agent"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CustomModel_providerName_modelId_key" ON "CustomModel"("providerName", "modelId");

-- CreateIndex
CREATE INDEX "CronJob_agentId_idx" ON "CronJob"("agentId");

-- CreateIndex
CREATE INDEX "CronJob_enabled_idx" ON "CronJob"("enabled");
