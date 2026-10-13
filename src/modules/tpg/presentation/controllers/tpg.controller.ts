import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';

import {
  PIXEL_ART_ALGORITHMS,
  type PixelateResponseDto,
  pixelateFromUrlRequestSchema,
  pixelateResponseSchema,
} from '@/shared/contracts/tpg.contract';
import { RequireRbac } from '@/shared/decorators/rbac.decorators';
import { ValidationError } from '@/shared/errors';

import { GeneratePixelArtHandler } from '../../application/commands/generatePixelArt.handler';

export { PIXEL_ART_ALGORITHMS };

class PixelateFromUrlDto extends createZodDto(pixelateFromUrlRequestSchema) {}
class PixelateResponseDtoClass extends createZodDto(pixelateResponseSchema) {}

/**
 * Stateless TPG endpoints: accept an image, return pixel art, keep nothing.
 * Requires a session — the generator is a signed-in product surface.
 */
@ApiTags('tpg')
@Controller('tpg')
export class TpgController {
  constructor(private readonly generate: GeneratePixelArtHandler) {}

  @Post('pixelate/url')
  @RequireRbac('tpg.pixelate.use')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Пикселизация изображения по прямому URL' })
  @ApiOkResponse({ type: PixelateResponseDtoClass })
  async pixelateFromUrl(@Body() body: PixelateFromUrlDto): Promise<PixelateResponseDto> {
    return this.generate.execute({
      imageUrl: body.imageUrl,
      pixelSize: body.pixelSize,
      algorithm: body.algorithm,
      paletteSize: body.paletteSize,
    });
  }

  @Post('pixelate/upload')
  @RequireRbac('tpg.pixelate.use')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Пикселизация загруженного файла' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        pixelSize: { type: 'integer', minimum: 2, maximum: 100, default: 8 },
        paletteSize: { type: 'integer', minimum: 2, maximum: 64, default: 24 },
        algorithm: {
          type: 'string',
          enum: [...PIXEL_ART_ALGORITHMS],
          default: 'quantize',
        },
      },
    },
  })
  @ApiOkResponse({ type: PixelateResponseDtoClass })
  async pixelateUpload(@Req() request: FastifyRequest): Promise<PixelateResponseDto> {
    const upload = await readUpload(request);
    return this.generate.execute({
      buffer: upload.buffer,
      ...(upload.pixelSize === undefined ? {} : { pixelSize: upload.pixelSize }),
      ...(upload.paletteSize === undefined ? {} : { paletteSize: upload.paletteSize }),
      ...(upload.algorithm === undefined ? {} : { algorithm: upload.algorithm }),
    });
  }
}

type UploadParts = {
  readonly buffer: Buffer;
  readonly pixelSize: number | undefined;
  readonly paletteSize: number | undefined;
  readonly algorithm: string | undefined;
};

async function readUpload(request: FastifyRequest): Promise<UploadParts> {
  const file = await request.file();

  if (file === undefined) {
    throw new ValidationError('Файл изображения не передан', [
      { path: 'image', message: 'Ожидается multipart-поле image' },
    ]);
  }

  const buffer = await file.toBuffer();
  return {
    buffer,
    pixelSize: readOptionalNumber(file.fields, 'pixelSize'),
    paletteSize: readOptionalNumber(file.fields, 'paletteSize'),
    algorithm: readOptionalString(file.fields, 'algorithm'),
  };
}

function readOptionalString(fields: Record<string, unknown>, key: string): string | undefined {
  const raw = (fields[key] as { value?: string } | undefined)?.value;
  return raw === undefined || raw.length === 0 ? undefined : raw;
}

function readOptionalNumber(fields: Record<string, unknown>, key: string): number | undefined {
  const raw = readOptionalString(fields, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new ValidationError(`Некорректное поле ${key}`, [
      { path: key, message: 'Ожидается число' },
    ]);
  }
  return value;
}
