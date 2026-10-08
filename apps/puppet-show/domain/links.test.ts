import { describe, expect, test } from "vitest";
import { IsRegistrationLink, IsSafeHttpUrl, LinkKindFor, OsmEmbedUrl, OsmPageUrl } from "./links";

describe("LinkKindFor", () => {
  test("registration labels", () => {
    expect(LinkKindFor("Inscrição")).toBe("registration");
    expect(LinkKindFor("INSCRIÇÕES no Sympla")).toBe("registration");
    expect(IsRegistrationLink("Inscrição")).toBe(true);
  });

  test("other known kinds", () => {
    expect(LinkKindFor("Instagram oficial")).toBe("social");
    expect(LinkKindFor("Transmissão ao vivo")).toBe("video");
    expect(LinkKindFor("Programação completa")).toBe("document");
    expect(LinkKindFor("Site do evento")).toBe("website");
  });

  test("unknown labels get the generic icon", () => {
    expect(LinkKindFor("Mais informações")).toBe("generic");
    expect(IsRegistrationLink("Mais informações")).toBe(false);
  });
});

describe("OpenStreetMap", () => {
  const point = { latitude: -12.2, longitude: -38.97 };

  test("embed has a bbox around the point and a marker", () => {
    const url = new URL(OsmEmbedUrl(point));
    expect(url.origin + url.pathname).toBe("https://www.openstreetmap.org/export/embed.html");
    expect(url.searchParams.get("bbox")).toBe("-38.974000,-12.204000,-38.966000,-12.196000");
    expect(url.searchParams.get("marker")).toBe("-12.2,-38.97");
  });

  test("page link", () => {
    expect(OsmPageUrl(point)).toBe("https://www.openstreetmap.org/?mlat=-12.2&mlon=-38.97#map=17/-12.2/-38.97");
  });
});

test("IsSafeHttpUrl", () => {
  expect(IsSafeHttpUrl("https://example.org/inscricao")).toBe(true);
  expect(IsSafeHttpUrl("http://example.org")).toBe(true);
  expect(IsSafeHttpUrl("javascript:alert(1)")).toBe(false);
  expect(IsSafeHttpUrl("example.org")).toBe(false);
});
