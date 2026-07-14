-- AlterTable
ALTER TABLE "ProductionLine" ADD COLUMN "dailyCapacity" INTEGER;

-- CreateTable
CREATE TABLE "DailyPlanEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planEntryId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "qty" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyPlanEntry_planEntryId_fkey" FOREIGN KEY ("planEntryId") REFERENCES "PlanEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyPlanEntry_date_idx" ON "DailyPlanEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlanEntry_planEntryId_date_key" ON "DailyPlanEntry"("planEntryId", "date");
