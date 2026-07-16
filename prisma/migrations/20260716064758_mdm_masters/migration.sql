-- CreateTable
CREATE TABLE "Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" INTEGER,
    "lineId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Facility_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Facility_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "spec" TEXT,
    "defaultLineId" INTEGER,
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "roundingValue" INTEGER,
    "orderPattern" TEXT,
    "defaultVendorId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_defaultLineId_fkey" FOREIGN KEY ("defaultLineId") REFERENCES "ProductionLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_defaultVendorId_fkey" FOREIGN KEY ("defaultVendorId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("code", "createdAt", "defaultLineId", "id", "isActive", "name", "spec", "type", "uom", "updatedAt") SELECT "code", "createdAt", "defaultLineId", "id", "isActive", "name", "spec", "type", "uom", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");
CREATE TABLE "new_ProductionLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weeklyCapacity" INTEGER NOT NULL,
    "dailyCapacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "siteId" INTEGER,
    CONSTRAINT "ProductionLine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionLine" ("code", "dailyCapacity", "id", "isActive", "name", "weeklyCapacity") SELECT "code", "dailyCapacity", "id", "isActive", "name", "weeklyCapacity" FROM "ProductionLine";
DROP TABLE "ProductionLine";
ALTER TABLE "new_ProductionLine" RENAME TO "ProductionLine";
CREATE UNIQUE INDEX "ProductionLine_code_key" ON "ProductionLine"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");
