import { expect, test } from "vitest";
import { MISSING_SITE_URL_MESSAGE, SiteQrCode } from "./siteQrCode";

test("builds an SVG QR code for the address", async () => {
  const qr = await SiteQrCode("https://mural.example.org");
  expect(qr.ok).toBe(true);
  if (qr.ok) {
    expect(qr.value.url).toBe("https://mural.example.org");
    expect(qr.value.svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
  }
});

test("a missing address is reported, never replaced", async () => {
  expect(await SiteQrCode(undefined)).toEqual({ ok: false, error: MISSING_SITE_URL_MESSAGE });
  expect(await SiteQrCode("  ")).toEqual({ ok: false, error: MISSING_SITE_URL_MESSAGE });
});

test("an invalid address is reported", async () => {
  const qr = await SiteQrCode("not a url");
  expect(qr.ok).toBe(false);
});
