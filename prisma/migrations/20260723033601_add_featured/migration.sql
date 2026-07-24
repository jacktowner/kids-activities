-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "priceMin" REAL NOT NULL DEFAULT 0,
    "priceMax" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "times" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Activity" ("address", "ageMax", "ageMin", "borough", "category", "createdAt", "description", "endDate", "id", "imageUrl", "isFree", "lat", "lng", "priceMax", "priceMin", "sourceName", "sourceUrl", "startDate", "times", "title", "updatedAt", "venue") SELECT "address", "ageMax", "ageMin", "borough", "category", "createdAt", "description", "endDate", "id", "imageUrl", "isFree", "lat", "lng", "priceMax", "priceMin", "sourceName", "sourceUrl", "startDate", "times", "title", "updatedAt", "venue" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
