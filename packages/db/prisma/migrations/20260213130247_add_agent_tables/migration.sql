/*
  Warnings:

  - You are about to drop the column `agentDefaults` on the `AppConfig` table. All the data in the column will be lost.
  - You are about to drop the column `bindings` on the `AppConfig` table. All the data in the column will be lost.

*/
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BindingRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agentId" TEXT NOT NULL,
    "cwdPattern" TEXT,
    "cwdExact" TEXT,
    "channel" TEXT,
    "accountId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BindingRule_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "thinkingLevel" TEXT NOT NULL DEFAULT 'medium',
    "activeThemeId" TEXT NOT NULL DEFAULT 'default-dark'
);
INSERT INTO "new_AppConfig" ("activeThemeId", "id", "thinkingLevel") SELECT "activeThemeId", "id", "thinkingLevel" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Agent_isDefault_idx" ON "Agent"("isDefault");

-- CreateIndex
CREATE INDEX "BindingRule_agentId_idx" ON "BindingRule"("agentId");

-- CreateIndex
CREATE INDEX "BindingRule_priority_idx" ON "BindingRule"("priority");
