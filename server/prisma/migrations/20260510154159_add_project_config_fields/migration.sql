-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "branch" TEXT NOT NULL DEFAULT 'main',
ADD COLUMN     "buildCommand" TEXT,
ADD COLUMN     "rootDir" TEXT,
ADD COLUMN     "runCommand" TEXT;
