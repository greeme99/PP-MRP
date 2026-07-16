-- CreateTable
CREATE TABLE "ProductionResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "lineId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "orderLineId" INTEGER,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "defectQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionResult_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionResult_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductionResult_lineId_date_idx" ON "ProductionResult"("lineId", "date");

-- CreateIndex
CREATE INDEX "ProductionResult_date_idx" ON "ProductionResult"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionResult_date_lineId_itemId_orderLineId_key" ON "ProductionResult"("date", "lineId", "itemId", "orderLineId");
