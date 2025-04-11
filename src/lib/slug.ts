// lib/slug.ts
import slugify from "slugify";

export function generateSlug(title: string, id?: number) {
  return `${slugify(title, { lower: false, strict: true })}_-_${id}`;
}
export function generateSlugImage(title: string) {
  return `${slugify(title, { lower: false, strict: true })}`;
}

export function extractIdFromSlug(slug: string): number {
  return parseInt(slug.split("_-_").pop()!);
}
