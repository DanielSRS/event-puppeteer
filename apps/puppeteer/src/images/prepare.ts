import sharp, { type Metadata } from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import type { ImageKind } from '../types/image.ts';
import { err, ok, type Result } from '../utils/result.ts';

/** The shape every Image of a kind must have, in pixels. */
interface ImageRules {
  /** Width to height, e.g. [16, 9]. */
  proportion: readonly [number, number];
  minimum: { width: number; height: number };
  /** The size a larger picture is scaled down to; smaller ones are never enlarged. */
  maximum: { width: number; height: number };
}

export const IMAGE_RULES: Record<ImageKind, ImageRules> = {
  event_banner: { proportion: [16, 9], minimum: { width: 960, height: 540 }, maximum: { width: 1920, height: 1080 } },
  organization_logo: { proportion: [1, 1], minimum: { width: 256, height: 256 }, maximum: { width: 512, height: 512 } }
};

/** The largest file accepted, kept under Vercel's 4.5 MB request body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** How far, in pixels, the height may be from the exact proportion (the cropper rounds). */
const PROPORTION_TOLERANCE = 1;

/** Pictures with more pixels than this are refused before decoding (decompression bombs). */
const MAX_INPUT_PIXELS = 50_000_000;

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/** An uploaded picture ready to be screened and stored. */
export interface PreparedImage {
  /** The normalized picture: WebP, no metadata, at most the maximum size for its kind. */
  webp: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  /** Base64 thumbhash of the normalized picture, from which the Placeholder is drawn. */
  thumbhash: string;
}

/** Why an uploaded file cannot become an Image. */
export type ImageRefusal = 'too_large' | 'unreadable' | 'unsupported_format' | 'wrong_proportion' | 'too_small';

/**
 * Turns an uploaded file into a normalized Image of `kind`.
 *
 * The file must be a still JPEG, PNG or WebP in the kind's proportion (after applying its
 * EXIF orientation) and at least its minimum size; it is never cropped or enlarged. The
 * result is always re-encoded as WebP without metadata, scaled down to exactly the
 * maximum size when larger, with the thumbhash of that normalized picture.
 */
export async function prepareImage(bytes: Uint8Array, kind: ImageKind): Promise<Result<PreparedImage, ImageRefusal>> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return err('too_large');
  const rules = IMAGE_RULES[kind];

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return err('unreadable');
  }
  if (metadata.format === undefined || !ACCEPTED_FORMATS.has(metadata.format) || (metadata.pages ?? 1) > 1) {
    return err('unsupported_format');
  }

  // Orientations 5 to 8 turn the picture a quarter: its displayed sides swap
  const turned = (metadata.orientation ?? 1) >= 5;
  const width = turned ? metadata.height : metadata.width;
  const height = turned ? metadata.width : metadata.height;
  const [across, down] = rules.proportion;
  if (Math.abs(height - (width * down) / across) > PROPORTION_TOLERANCE) return err('wrong_proportion');
  if (width < rules.minimum.width || height < rules.minimum.height) return err('too_small');

  try {
    let pipeline = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
    if (width > rules.maximum.width || height > rules.maximum.height) {
      pipeline = pipeline.resize(rules.maximum.width, rules.maximum.height, { fit: 'fill' });
    }
    const { data, info } = await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return ok({ webp: Uint8Array.from(data), width: info.width, height: info.height, thumbhash: await thumbhashOf(data) });
  } catch {
    return err('unreadable');
  }
}

/** The thumbhash of a picture, computed on a copy scaled to fit 100×100 (the encoder's limit). */
async function thumbhashOf(picture: Uint8Array): Promise<string> {
  const { data, info } = await sharp(picture)
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');
}
