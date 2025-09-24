import { slugify } from 'src/class/class.util';

export async function generateUniqueAssignmentSlug(
  title: string,
  prisma: any,
): Promise<string> {
  const base = slugify(title);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const exists = await prisma.assignment.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    attempt += 1;
  }
}
