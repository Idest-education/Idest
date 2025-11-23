-- AlterTable
ALTER TABLE "SessionAttendance" ADD COLUMN     "attended_at" TIMESTAMP(3),
ADD COLUMN     "is_attended" BOOLEAN NOT NULL DEFAULT false;
