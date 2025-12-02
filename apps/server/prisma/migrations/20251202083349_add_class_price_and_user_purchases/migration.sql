-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'vnd',
ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "purchases" TEXT[] DEFAULT ARRAY[]::TEXT[];
