/**
 * Re-exports sprite/media contract surface from `@twilite/contracts`.
 * Prefer importing from the package in new code; this file keeps existing paths stable.
 */
export {
  type DeletePixelObjectResult,
  deletePixelObjectResultSchema,
  PIXEL_OBJECT_CANVAS_MAX,
  PIXEL_OBJECT_FORMAT,
  PIXEL_OBJECT_MAX_FRAME_DURATION_MS,
  PIXEL_OBJECT_MIN_FRAME_DURATION_MS,
  type PixelObjectDto,
  type PixelObjectManifest,
  type PixelObjectType,
  type PixelObjectMobileDto,
  pixelObjectDtoSchema,
  pixelObjectListSchema,
  pixelObjectManifestSchema,
  pixelObjectMobileSchema,
  pixelObjectStatusSchema,
  pixelObjectTypeSchema,
  type ReassignPixelObjectDto,
  reassignPixelObjectSchema,
  rejectPixelObjectSchema,
  type SubmitPixelObjectDto,
  submitPixelObjectSchema,
} from '@twilite/contracts';
