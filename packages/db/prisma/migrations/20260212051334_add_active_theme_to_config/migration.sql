-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "thinkingLevel" TEXT NOT NULL DEFAULT 'medium',
    "activeThemeId" TEXT NOT NULL DEFAULT 'default-dark'
);
INSERT INTO "new_AppConfig" ("id", "thinkingLevel") SELECT "id", "thinkingLevel" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
