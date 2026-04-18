import { z } from 'zod';

const intTripletSchema = z.array(z.number().int().min(0)).length(3);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(40),
});

export const teamBuildSchema = z.object({
  mainUnitIds: intTripletSchema,
  unisonUnitIds: intTripletSchema,
  equipmentIds: intTripletSchema,
  soulIds: intTripletSchema,
  slotMeta: z.record(z.string(), z.unknown()).optional(),
});

export const createTeamSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  sourceType: z.enum(['save_slot', 'eliya_link', 'custom']),
  targetId: z.number().int().positive().optional(),
  bossLabel: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  build: teamBuildSchema,
  rawSnapshot: z.record(z.string(), z.unknown()),
});

export const submitTeamSchema = z.object({
  id: z.string().uuid(),
});

export const importSaveSchema = z.object({
  saveJson: z.unknown(),
  groupId: z.union([z.string(), z.number()]),
  slotId: z.union([z.string(), z.number()]),
});

export const importEliyaSchema = z.object({
  link: z.string().trim().min(1),
});

export const moderationNoteSchema = z.object({
  note: z.string().trim().max(2000).optional().default(''),
});

export const rejectNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

export const createSaveShareSchema = z.object({
  saveJson: z.unknown(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional().default('private'),
  expiresAt: z.string().datetime().optional(),
});

export const createReportSchema = z.object({
  entityType: z.enum(['team', 'save_share']),
  entityId: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40).optional(),
    avatarUrl: z.union([z.string().trim().url().max(1024), z.literal(''), z.null()]).optional(),
  })
  .refine((payload) => payload.displayName !== undefined || payload.avatarUrl !== undefined, {
    message: 'No profile fields provided.',
  });
