import { ValidationError } from '@/shared/errors';

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

/** Reject empty / oversized / non-image payloads before sharp runs. */
export function assertImageBuffer(buffer: Buffer, maxBytes: number): void {
  if (buffer.byteLength === 0) {
    throw new ValidationError('Пустое изображение', [
      { path: 'image', message: 'Файл не содержит данных' },
    ]);
  }

  if (buffer.byteLength > maxBytes) {
    throw new ValidationError('Изображение слишком большое', [
      { path: 'image', message: `Максимум ${maxBytes} байт` },
    ]);
  }

  if (!looksLikeImage(buffer)) {
    throw new ValidationError('Файл не является изображением', [
      { path: 'image', message: 'Ожидается PNG, JPEG, GIF или WebP' },
    ]);
  }
}

function looksLikeImage(buffer: Buffer): boolean {
  if (startsWith(buffer, PNG) || startsWith(buffer, JPEG) || startsWith(buffer, GIF)) {
    return true;
  }

  // WebP: RIFF....WEBP
  if (startsWith(buffer, WEBP_RIFF) && buffer.byteLength >= 12) {
    return buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  return false;
}

function startsWith(buffer: Buffer, magic: readonly number[]): boolean {
  if (buffer.byteLength < magic.length) return false;
  return magic.every((byte, index) => buffer[index] === byte);
}
