/**
 * Geometry of cropping a picture to an Image's fixed proportion.
 *
 * The API refuses Images off their proportion or below their minimum size and
 * never crops them itself, so the person picks the area here. A crop is an area
 * of the source picture, in its own pixels. Zoom 1 is the largest area of the
 * proportion that fits; zooming in shrinks the area (never below the minimum).
 *
 * @module
 */

import { Err, Ok, type Result } from "@/lib/result";

/** A size in pixels. */
export type Size = { width: number; height: number };

/** A point of the source picture, in its pixels. */
export type Point = { x: number; y: number };

/** An area of the source picture, in its pixels. */
export type Crop = Point & Size;

/** The shape the API requires of one kind of Image. */
export type CropRules = {
  /** Width to height, e.g. [16, 9]. */
  proportion: readonly [number, number];
  minimum: Size;
  /** Larger areas are scaled down to this size before upload. */
  maximum: Size;
};

/** Event banners: 16:9, from 960×540, stored at most at 1920×1080 (the kiosk screen). */
export const BANNER_RULES: CropRules = { proportion: [16, 9], minimum: { width: 960, height: 540 }, maximum: { width: 1920, height: 1080 } };

/** Organization logos: square, from 256×256, stored at most at 512×512. */
export const LOGO_RULES: CropRules = { proportion: [1, 1], minimum: { width: 256, height: 256 }, maximum: { width: 512, height: 512 } };

/** The largest area of the proportion that fits in the picture. */
function FullCrop(source: Size, rules: CropRules): Size {
  const [across, down] = rules.proportion;
  const width = Math.min(source.width, (source.height * across) / down);
  return { width, height: (width * down) / across };
}

/** Clamps `value` between `low` and `high`. */
function Clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * How far the picture can be zoomed in before the area gets smaller than the minimum.
 * Fails when even the largest area is below the minimum: the picture is too small.
 */
export function MaxZoom(source: Size, rules: CropRules): Result<number, "too-small"> {
  const full = FullCrop(source, rules);
  if (full.width < rules.minimum.width || full.height < rules.minimum.height) return Err("too-small");
  return Ok(full.width / rules.minimum.width);
}

/**
 * The area at `zoom`, centred on `center` (`null` = the picture's centre) and moved
 * back inside the picture when it would cross an edge.
 */
export function CropAt(source: Size, rules: CropRules, zoom: number, center: Point | null): Crop {
  const full = FullCrop(source, rules);
  const width = full.width / zoom;
  const height = full.height / zoom;
  const at = center ?? { x: source.width / 2, y: source.height / 2 };
  return {
    x: Clamp(at.x - width / 2, 0, source.width - width),
    y: Clamp(at.y - height / 2, 0, source.height - height),
    width,
    height,
  };
}

/** The area moved by `dx`, `dy` source pixels, stopping at the picture's edges. */
export function MovedCrop(source: Size, crop: Crop, dx: number, dy: number): Crop {
  return {
    ...crop,
    x: Clamp(crop.x + dx, 0, source.width - crop.width),
    y: Clamp(crop.y + dy, 0, source.height - crop.height),
  };
}

/**
 * The size the cropped picture is drawn at: the area's own size, or the maximum when
 * larger, in whole pixels with the height following the exact proportion.
 */
export function OutputSize(crop: Crop, rules: CropRules): Size {
  const [across, down] = rules.proportion;
  const width = Math.min(Math.round(crop.width), rules.maximum.width);
  return { width, height: Math.round((width * down) / across) };
}
