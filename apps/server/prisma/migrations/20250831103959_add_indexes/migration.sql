-- CreateIndex
CREATE INDEX "ClassMember_class_id_student_id_idx" ON "ClassMember"("class_id", "student_id");

-- CreateIndex
CREATE INDEX "ClassTeacher_class_id_teacher_id_idx" ON "ClassTeacher"("class_id", "teacher_id");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_userId_idx" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");
