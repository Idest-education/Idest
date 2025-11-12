/*
  Warnings:

  - You are about to drop the `AiGradingLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignmentSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatbotLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Progress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionSubmission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Submission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AiGradingLog" DROP CONSTRAINT "AiGradingLog_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentSection" DROP CONSTRAINT "AssignmentSection_assignment_id_fkey";

-- DropForeignKey
ALTER TABLE "ChatbotLog" DROP CONSTRAINT "ChatbotLog_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_from_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_student_id_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_group_id_fkey";

-- DropForeignKey
ALTER TABLE "QuestionGroup" DROP CONSTRAINT "QuestionGroup_section_id_fkey";

-- DropForeignKey
ALTER TABLE "QuestionSubmission" DROP CONSTRAINT "QuestionSubmission_question_id_fkey";

-- DropForeignKey
ALTER TABLE "QuestionSubmission" DROP CONSTRAINT "QuestionSubmission_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_assignment_id_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_student_id_fkey";

-- DropTable
DROP TABLE "AiGradingLog";

-- DropTable
DROP TABLE "AssignmentSection";

-- DropTable
DROP TABLE "ChatbotLog";

-- DropTable
DROP TABLE "Feedback";

-- DropTable
DROP TABLE "Progress";

-- DropTable
DROP TABLE "Question";

-- DropTable
DROP TABLE "QuestionGroup";

-- DropTable
DROP TABLE "QuestionSubmission";

-- DropTable
DROP TABLE "Submission";
