import { describe, expect, it } from "vitest";
import { Monogram } from "./monogram";

describe("Monogram", () => {
  it("keeps an acronym already in the name", () => {
    expect(Monogram("UEFS")).toBe("UEFS");
    expect(Monogram("IFBA Feira de Santana")).toBe("IFBA");
  });

  it("takes the first letters of the first two words, skipping small words", () => {
    expect(Monogram("Universidade Estadual de Feira de Santana")).toBe("UE");
    expect(Monogram("Ana Ribeiro")).toBe("AR");
    expect(Monogram("Dev")).toBe("D");
  });

  it("never returns an empty string", () => {
    expect(Monogram("   ")).toBe("?");
  });
});
