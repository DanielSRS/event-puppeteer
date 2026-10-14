import { describe, expect, test } from "vitest";
import { PolicyToForm, ValidateScreeningPolicyForm, type ScreeningPolicyFormValues } from "./screening-policy-form-values";

/** Every category at 30% / 80%. */
function Filled(): ScreeningPolicyFormValues {
  const values = PolicyToForm(null);
  for (const cutOffs of Object.values(values)) {
    cutOffs.lower = "30";
    cutOffs.upper = "80";
  }
  return values;
}

describe("PolicyToForm", () => {
  test("empty while there is no policy", () => {
    expect(PolicyToForm(null).nudity).toEqual({ lower: "", upper: "" });
  });

  test("fractions become whole percentages", () => {
    const policy = ValidateScreeningPolicyForm(Filled());
    expect(policy.ok).toBe(true);
    if (!policy.ok) return;
    expect(PolicyToForm({ ...policy.value, hate: { lower: 0.15, upper: 0.7 } }).hate).toEqual({ lower: "15", upper: "70" });
  });
});

describe("ValidateScreeningPolicyForm", () => {
  test("percentages become the fractions the API takes", () => {
    const result = ValidateScreeningPolicyForm({ ...Filled(), hate: { lower: "15", upper: "70" } });
    expect(result.ok && result.value.hate).toEqual({ lower: 0.15, upper: 0.7 });
    expect(result.ok && result.value.nudity).toEqual({ lower: 0.3, upper: 0.8 });
  });

  test("points out each category with a missing, out-of-range or inverted cut-off", () => {
    const result = ValidateScreeningPolicyForm({
      ...Filled(),
      nudity: { lower: "", upper: "80" },
      gore: { lower: "30", upper: "120" },
      weapons: { lower: "90", upper: "20" },
    });
    expect(result).toEqual({
      ok: false,
      error: {
        nudity: "Informe os dois limites como números inteiros de 0 a 100.",
        gore: "Informe os dois limites como números inteiros de 0 a 100.",
        weapons: "O limite de revisão não pode passar o de recusa.",
      },
    });
  });
});
