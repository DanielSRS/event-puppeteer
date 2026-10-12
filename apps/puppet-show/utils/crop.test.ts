import { describe, expect, test } from "vitest";
import { BANNER_RULES, CropAt, LOGO_RULES, MaxZoom, MovedCrop, OutputSize } from "./crop";

describe("CropAt", () => {
  test("without zoom, takes the largest 16:9 area centred in the picture", () => {
    expect(CropAt({ width: 4000, height: 3000 }, BANNER_RULES, 1, null)).toEqual({ x: 0, y: 375, width: 4000, height: 2250 });
    expect(CropAt({ width: 1000, height: 3000 }, LOGO_RULES, 1, null)).toEqual({ x: 0, y: 1000, width: 1000, height: 1000 });
  });

  test("zooming in shrinks the area around the chosen centre, never leaving the picture", () => {
    expect(CropAt({ width: 4000, height: 3000 }, BANNER_RULES, 2, { x: 2000, y: 1500 })).toEqual({ x: 1000, y: 937.5, width: 2000, height: 1125 });
    expect(CropAt({ width: 4000, height: 3000 }, BANNER_RULES, 2, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 2000, height: 1125 });
    expect(CropAt({ width: 4000, height: 3000 }, BANNER_RULES, 2, { x: 4000, y: 3000 })).toEqual({ x: 2000, y: 1875, width: 2000, height: 1125 });
  });
});

describe("MaxZoom", () => {
  test("allows zooming until the area reaches the minimum size", () => {
    expect(MaxZoom({ width: 3840, height: 2160 }, BANNER_RULES)).toEqual({ ok: true, value: 4 });
    expect(MaxZoom({ width: 960, height: 540 }, BANNER_RULES)).toEqual({ ok: true, value: 1 });
  });

  test("refuses a picture whose largest area is below the minimum", () => {
    expect(MaxZoom({ width: 800, height: 450 }, BANNER_RULES)).toEqual({ ok: false, error: "too-small" });
    expect(MaxZoom({ width: 2000, height: 200 }, LOGO_RULES)).toEqual({ ok: false, error: "too-small" });
  });
});

describe("MovedCrop", () => {
  test("moves the area by the given pixels, stopping at the picture's edges", () => {
    const source = { width: 4000, height: 3000 };
    const crop = { x: 1000, y: 937.5, width: 2000, height: 1125 };
    expect(MovedCrop(source, crop, 500, -100)).toEqual({ x: 1500, y: 837.5, width: 2000, height: 1125 });
    expect(MovedCrop(source, crop, -5000, 5000)).toEqual({ x: 0, y: 1875, width: 2000, height: 1125 });
  });
});

describe("OutputSize", () => {
  test("scales a large area down to the maximum", () => {
    expect(OutputSize({ x: 0, y: 0, width: 3840, height: 2160 }, BANNER_RULES)).toEqual({ width: 1920, height: 1080 });
    expect(OutputSize({ x: 0, y: 0, width: 900, height: 900 }, LOGO_RULES)).toEqual({ width: 512, height: 512 });
  });

  test("keeps a smaller area's size, rounded to whole pixels in the exact proportion", () => {
    expect(OutputSize({ x: 0, y: 0, width: 1000.4, height: 562.7 }, BANNER_RULES)).toEqual({ width: 1000, height: 563 });
  });
});
