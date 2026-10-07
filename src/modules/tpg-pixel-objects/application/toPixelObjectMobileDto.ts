import type {
  PixelObjectManifest,
  PixelObjectMobileDto,
  PixelObjectType,
} from '@/shared/contracts/pixelObjects.contract';

export function toPixelObjectMobileDto(input: {
  readonly id: string;
  readonly title: string;
  readonly objectType: PixelObjectType;
  readonly sheetUrl: string;
  readonly manifest: PixelObjectManifest;
  readonly revision?: number;
  readonly previewUrl?: string | null;
}): PixelObjectMobileDto {
  const { manifest } = input;
  return {
    id: input.id,
    title: input.title,
    objectType: input.objectType,
    revision: input.revision,
    format: manifest.format,
    sheetUrl: input.sheetUrl,
    previewUrl: input.previewUrl ?? null,
    canvas: manifest.canvas,
    sheet: {
      frameWidth: manifest.sheet.frameWidth,
      frameHeight: manifest.sheet.frameHeight,
      columns: manifest.sheet.columns,
      rows: manifest.sheet.rows,
      frameCount: manifest.sheet.frameCount,
    },
    animations: manifest.animations,
    staticPreviewFrame: manifest.staticPreviewFrame,
  };
}
