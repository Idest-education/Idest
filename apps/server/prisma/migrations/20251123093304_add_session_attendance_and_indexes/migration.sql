-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionAttendance_session_id_idx" ON "SessionAttendance"("session_id");

-- CreateIndex
CREATE INDEX "SessionAttendance_user_id_idx" ON "SessionAttendance"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_session_id_user_id_key" ON "SessionAttendance"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "Session_class_id_start_time_idx" ON "Session"("class_id", "start_time");

-- CreateIndex
CREATE INDEX "Session_host_id_start_time_idx" ON "Session"("host_id", "start_time");

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
