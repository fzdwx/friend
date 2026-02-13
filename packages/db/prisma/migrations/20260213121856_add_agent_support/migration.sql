-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "agentDefaults" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "bindings" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "agentId" TEXT NOT NULL DEFAULT 'main',
    "model" TEXT,
    "workingPath" TEXT,
    "sessionFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Session" ("createdAt", "id", "model", "name", "sessionFile", "updatedAt", "workingPath") SELECT "createdAt", "id", "model", "name", "sessionFile", "updatedAt", "workingPath" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_agentId_idx" ON "Session"("agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
