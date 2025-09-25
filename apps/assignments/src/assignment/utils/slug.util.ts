import { v4 as uuidv4 } from 'uuid';

export function generateSlugFromTitle(title: string): string {
  const base = (title || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = uuidv4().split('-')[0];
  return base ? `${base}-${suffix}` : suffix;
}


