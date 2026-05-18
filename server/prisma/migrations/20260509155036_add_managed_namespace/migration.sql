-- CreateTable
CREATE TABLE "ManagedNamespace" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "labels" JSONB,
    "resourceQuota" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedNamespace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedNamespace_projectId_key" ON "ManagedNamespace"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedNamespace_name_key" ON "ManagedNamespace"("name");

-- AddForeignKey
ALTER TABLE "ManagedNamespace" ADD CONSTRAINT "ManagedNamespace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
