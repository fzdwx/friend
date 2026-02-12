-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "workingPath" TEXT,
    "sessionFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "thinkingLevel" TEXT NOT NULL DEFAULT 'medium'
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

-- CreateIndex
CREATE UNIQUE INDEX "CustomModel_providerName_modelId_key" ON "CustomModel"("providerName", "modelId");
