import { z } from 'zod';

export const THEME_COLOR_KEYS = [
  'surface',
  'surfaceRaised',
  'surfaceSunken',
  'surfaceDivider',
  'surfaceOverlay',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textInverted',
  'accent',
  'accentSoft',
  'accentPressed',
  'accentOn',
  'secondary',
  'secondarySoft',
  'tertiary',
  'tertiarySoft',
  'positive',
  'negative',
  'warning',
  'glassTint',
  'glassRim',
  'glassRimAndroid',
  'glassFillAndroid',
  'controlActive',
  'controlInactive',
  'controlTrack',
  'scrim',
  'skeleton',
  'focusRing',
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

const cssColorSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      /^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value) ||
      /^rgba?\(/.test(value),
    'Invalid CSS color',
  );

const opaqueHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Sky stop must be #RRGGBB');

const themeColorsShape = Object.fromEntries(
  THEME_COLOR_KEYS.map((key) => [key, cssColorSchema]),
) as Record<ThemeColorKey, typeof cssColorSchema>;

export const themeColorsSchema = z.object(themeColorsShape).strict();

export const sceneBackgroundColorsSchema = z
  .array(opaqueHexSchema)
  .min(2)
  .max(5);

export const appThemeStatusSchema = z.enum(['pending', 'published', 'rejected']);

export const submitAppThemeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).default(''),
  colors: themeColorsSchema,
  sceneBackgroundColors: sceneBackgroundColorsSchema,
});

export const updateRejectedAppThemeSchema = submitAppThemeSchema;

export const rejectAppThemeSchema = z.object({
  comment: z.string().trim().min(3).max(2000),
});

export const generateAppThemeSchema = z.object({
  model: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(4000),
});

export const appThemeDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  authorDisplayName: z.string(),
  authorUserId: z.string().uuid(),
  status: appThemeStatusSchema,
  rejectionComment: z.string().nullable(),
  colors: themeColorsSchema,
  sceneBackgroundColors: sceneBackgroundColorsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
});

export const appThemeListSchema = z.object({
  items: z.array(appThemeDtoSchema),
});

export const freeModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextLength: z.number().nullable(),
});

export const freeModelsResponseSchema = z.object({
  items: z.array(freeModelSchema),
});

export const generatedAppThemeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000),
  colors: themeColorsSchema,
  sceneBackgroundColors: sceneBackgroundColorsSchema,
});

export type SubmitAppThemeDto = z.infer<typeof submitAppThemeSchema>;
export type AppThemeDto = z.infer<typeof appThemeDtoSchema>;
export type GeneratedAppThemeDto = z.infer<typeof generatedAppThemeSchema>;
