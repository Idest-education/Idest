import { FullClassResponseDto, UserSummaryDto } from "./dto/class-response.dto";

export function toFullClassResponseDto(classData: any): FullClassResponseDto {
  return {
    id: classData.id,
    name: classData.name,
    slug: classData.slug,
    description: classData.description ?? null,
    is_group: classData.is_group,
    invite_code: classData.invite_code,
    created_by: classData.created_by,
    schedule: classData.schedule ?? null,
    creator: {
      id: classData.creator.id,
      full_name: classData.creator.full_name,
      email: classData.creator.email,
      avatar_url: classData.creator.avatar_url ?? undefined,
      role: classData.creator.role,
    },
    _count: classData._count,
    members: classData.members.map((m: any) => ({
      id: m.student.id,
      full_name: m.student.full_name,
      email: m.student.email,
      avatar_url: m.student.avatar_url ?? undefined,
      role: m.student.role,
    })),
    teachers: classData.teachers.map((t: any) => ({
      id: t.teacher.id,
      full_name: t.teacher.full_name,
      email: t.teacher.email,
      avatar_url: t.teacher.avatar_url ?? undefined,
      role: t.teacher.role,
    })),
    sessions: classData.sessions.map((s: any) => ({
      id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      host: {
        id: s.host.id,
        full_name: s.host.full_name,
        email: s.host.email,
      },
    })),
  };
}


export function mapUsersToDto(relations: { student?: any; teacher?: any }[]): UserSummaryDto[] {
  return relations.map(r => {
    const user = r.student ?? r.teacher; // pick whichever exists
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      avatar_url: user.avatar_url ?? undefined,
      role: user.role,
    };
  });
}


  /**
   * Helper: Generate unique invite code
   */
  export async function generateUniqueInviteCode(): Promise<string> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 8;
    const generate = () =>
      Array.from({ length }, () =>
        alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
      ).join('');

    // Loop until we have a unique code
    // Guard against extremely rare infinite loops by capping attempts
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generate();
      const existing = await this.prisma.class.findUnique({
        where: { invite_code: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    // Fallback
    return `${Date.now()}`.slice(-8).toUpperCase();
  }

  /**
   * Generate a unique slug for a class name by replacing spaces with hyphens
   * and appending an incrementing number if needed.
   */
  export async function generateUniqueSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    let attempt = 0;
    while (true) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const exists = await this.prisma.class.findFirst({
        where: { slug: candidate } as any,
        select: { id: true },
      });
      if (!exists) return candidate;
      attempt += 1;
    }
  }

  export function slugify(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Helper: Check if user has access to class
   */
  export function checkClassAccess(classData: any, userId: string): boolean {
    // Creator
    if (classData.created_by === userId) return true;

    // Teacher
    if (classData.teachers.some((t: any) => t.teacher_id === userId))
      return true;

    // Active student
    if (
      classData.members.some(
        (m: any) => m.student_id === userId && m.status === 'active',
      )
    )
      return true;

    return false;
  }

  /**
   * Helper: Check access by class id
   */
  export async function checkClassAccessById(
    classId: string,
    userId: string,
  ): Promise<boolean> {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { teachers: true, members: true },
    });
    if (!classData) return false;
    return this.checkClassAccess(classData, userId);
  }

  /**
   * Helper: Check if user can manage class (creator or teacher)
   */
  export async function checkClassManagementPermission(
    classId: string,
    userId: string,
  ): Promise<boolean> {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        teachers: true,
      },
    });

    if (!classData) return false;

    // Creator
    if (classData.created_by === userId) return true;

    // Teacher
    if (classData.teachers.some((t) => t.teacher_id === userId)) return true;

    return false;
  }
