import { v4 as uuidv4 } from 'uuid';
import { Model } from 'mongoose';

export async function generateUniqueSlug(
  title: string,
  assignmentModel: Model<any>,
): Promise<string> {
  const base = (title || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  let slug = '';
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    const suffix = uuidv4().split('-')[0];
    slug = base ? `${base}-${suffix}` : suffix;
    
    const existing = await assignmentModel.findOne({ slug }).exec();
    exists = !!existing;
    attempts++;
  }

  if (exists) {
    // fallback 
    slug = uuidv4();
  }

  return slug;
}

