-- AlterEnum: Add new QuestionType values
ALTER TYPE "QuestionType" ADD VALUE 'MULTI_CHOICE';
ALTER TYPE "QuestionType" ADD VALUE 'MATCH_LR';
ALTER TYPE "QuestionType" ADD VALUE 'WORD_CLOUD';

-- AlterEnum: Add PAUSED to GameSessionStatus
ALTER TYPE "GameSessionStatus" ADD VALUE 'PAUSED';

-- AlterTable: Add isMultiAnswer to GameQuestion
ALTER TABLE "GameQuestion" ADD COLUMN "isMultiAnswer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: GameMatchPair
CREATE TABLE "GameMatchPair" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "leftLabel" TEXT NOT NULL,
    "rightText" TEXT NOT NULL,

    CONSTRAINT "GameMatchPair_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: GameMatchPair -> GameQuestion
ALTER TABLE "GameMatchPair" ADD CONSTRAINT "GameMatchPair_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GameQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add pausedAt and hiddenWords to GameSession
ALTER TABLE "GameSession" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "GameSession" ADD COLUMN "hiddenWords" TEXT;

-- AlterTable: Add streak fields to GameParticipant
ALTER TABLE "GameParticipant" ADD COLUMN "answerStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GameParticipant" ADD COLUMN "maxAnswerStreak" INTEGER NOT NULL DEFAULT 0;
