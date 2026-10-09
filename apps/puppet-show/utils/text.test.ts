import { describe, expect, test } from "vitest";
import { SortByName } from "./text";

describe("SortByName", () => {
  test("orders by name ignoring accents and case, without touching the input", () => {
    const input = [{ name: "Universidade Estadual" }, { name: "Ágora" }, { name: "outra organização" }, { name: "Banco" }];
    expect(SortByName(input).map((item) => item.name)).toEqual(["Ágora", "Banco", "outra organização", "Universidade Estadual"]);
    expect(input[0].name).toBe("Universidade Estadual");
  });
});
