-- CreateTable
CREATE TABLE "MachineInventory" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineInventory_machineId_hash_key" ON "MachineInventory"("machineId", "hash");
CREATE INDEX "MachineInventory_machineId_capturedAt_idx" ON "MachineInventory"("machineId", "capturedAt");

-- AddForeignKey
ALTER TABLE "MachineInventory" ADD CONSTRAINT "MachineInventory_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AdvisorFinding" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "AdvisorFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorFinding_machineId_ruleId_key" ON "AdvisorFinding"("machineId", "ruleId");
CREATE INDEX "AdvisorFinding_machineId_category_idx" ON "AdvisorFinding"("machineId", "category");
CREATE INDEX "AdvisorFinding_machineId_detectedAt_idx" ON "AdvisorFinding"("machineId", "detectedAt");

-- AddForeignKey
ALTER TABLE "AdvisorFinding" ADD CONSTRAINT "AdvisorFinding_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
