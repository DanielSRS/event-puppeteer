import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { CreateTagInput, CreateLinkLabelInput } from '../types/tag.ts';
import { requireAuth } from './users.ts';

export async function createTagHandler(request: Request, body: CreateTagInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  return await io.tagRepo.create({
    id: randomUUID(),
    name: body.name,
    isSystemDefined: body.isSystemDefined
  });
}

export async function listTagsHandler(io: AppIO) {
  return await io.tagRepo.getAll();
}

export async function createLinkLabelHandler(request: Request, body: CreateLinkLabelInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  return await io.linkLabelRepo.create({
    id: randomUUID(),
    name: body.name
  });
}

export async function listLinkLabelsHandler(io: AppIO) {
  return await io.linkLabelRepo.getAll();
}
