-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FILL_BLANK');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'ENDED');

-- CreateTable
CREATE TABLE "GameTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "order" INTEGER NOT NULL,
    "timerSeconds" INTEGER NOT NULL DEFAULT 20,
    "correctAnswer" TEXT NOT NULL,

    CONSTRAINT "GameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "GameOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'WAITING',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "lastSeenQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTemplate_createdBy_idx" ON "GameTemplate"("createdBy");

-- CreateIndex
CREATE INDEX "GameSession_sessionId_status_idx" ON "GameSession"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_sessionId_userId_key" ON "GameParticipant"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAnswer_participantId_questionId_key" ON "GameAnswer"("participantId", "questionId");

-- CreateIndex
CREATE INDEX "GameAnswer_sessionId_questionId_idx" ON "GameAnswer"("sessionId", "questionId");

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GameTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameOption" ADD CONSTRAINT "GameOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GameQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GameTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GameQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
