import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Check if user has access to a class
 * User has access if they are:
 * - Class creator
 * - Class teacher
 * - Active class member
 */
export async function checkClassAccess(
  prisma: PrismaService,
  classId: string,
  userId: string,
): Promise<boolean> {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teachers: true,
      members: true,
    },
  });

  if (!classData) return false;

  // Creator
  if (classData.created_by === userId) return true;

  // Teacher
  if (classData.teachers.some((t) => t.teacher_id === userId)) return true;

  // Active student
  if (
    classData.members.some(
      (m) => m.student_id === userId && m.status === 'active',
    )
  )
    return true;

  return false;
}

/**
 * Get all participants for a class conversation
 * Includes: creator, all active students, all teachers
 */
export async function getClassConversationParticipants(
  prisma: PrismaService,
  classId: string,
  conversationId: string,
): Promise<{ userId: string; conversationId: string }[]> {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      members: { where: { status: 'active' } },
      teachers: true,
    },
  });

  if (!classData) return [];

  const participants: { userId: string; conversationId: string }[] = [];

  // Add creator
  participants.push({ userId: classData.created_by, conversationId });

  // Add all active students
  participants.push(
    ...classData.members.map((member) => ({
      userId: member.student_id,
      conversationId,
    })),
  );

  // Add all teachers
  participants.push(
    ...classData.teachers.map((teacher) => ({
      userId: teacher.teacher_id,
      conversationId,
    })),
  );

  // Remove duplicates
  return participants.filter(
    (participant, index, self) =>
      index === self.findIndex((p) => p.userId === participant.userId),
  );
}
