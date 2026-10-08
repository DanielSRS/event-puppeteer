import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { CreateTagInput, CreateLinkLabelInput } from '../types/tag.ts';
import { requireAuth } from './users.ts';

/**
 * Trims a Tag or Link Label name.
 * @throws BAD_REQUEST when nothing is left after trimming.
 */
function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('BAD_REQUEST');
  return trimmed;
}

/**
 * Creates a Tag. Any logged-in User may create a free-form Tag (to label their own
 * Events); only a Superadmin may create a system-defined one.
 * @throws UNAUTHORIZED without a valid session.
 * @throws FORBIDDEN when a non-Superadmin asks for a system-defined Tag.
 * @throws BAD_REQUEST when the name is blank.
 * @throws TAG_EXISTS when a Tag with the same name (ignoring case and surrounding whitespace) exists.
 */
export async function createTagHandler(request: Request, body: CreateTagInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (body.isSystemDefined && actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  const name = cleanName(body.name);
  if (await io.tagRepo.findByName(name)) throw new Error('TAG_EXISTS');

  return await io.tagRepo.create({
    id: randomUUID(),
    name,
    isSystemDefined: body.isSystemDefined
  });
}

export async function listTagsHandler(io: AppIO) {
  return await io.tagRepo.getAll();
}

/**
 * Creates a Link Label. Superadmin only.
 * @throws UNAUTHORIZED without a valid session.
 * @throws FORBIDDEN when the actor is not a Superadmin.
 * @throws BAD_REQUEST when the name is blank.
 * @throws LINK_LABEL_EXISTS when a Link Label with the same name (ignoring case and surrounding whitespace) exists.
 */
export async function createLinkLabelHandler(request: Request, body: CreateLinkLabelInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  const name = cleanName(body.name);
  if (await io.linkLabelRepo.findByName(name)) throw new Error('LINK_LABEL_EXISTS');

  return await io.linkLabelRepo.create({
    id: randomUUID(),
    name
  });
}

export async function listLinkLabelsHandler(io: AppIO) {
  return await io.linkLabelRepo.getAll();
}
