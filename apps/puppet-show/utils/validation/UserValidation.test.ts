import { describe, expect, test } from "vitest";
import { SafeRedirect, ValidateEmail, ValidateNewPassword, ValidateUser } from "./UserValidation";
import { FormatPersonName, SplitName } from "@/utils/text";

test("valid login", () => {
  expect(ValidateUser({ name: "", email: "a@b.co", password: "12345678" }, { requireName: false })).toEqual({});
});

test("sign-up needs first and last name", () => {
  expect(ValidateUser({ name: "Maria", email: "a@b.co", password: "12345678" }, { requireName: true }).name).toBeDefined();
  expect(ValidateUser({ name: " Maria  Souza ", email: "a@b.co", password: "12345678" }, { requireName: true })).toEqual({});
});

test("bad email and short password", () => {
  const errors = ValidateUser({ name: "", email: "x@", password: "123" }, { requireName: false });
  expect(Object.keys(errors).sort()).toEqual(["email", "password"]);
});

test("names", () => {
  expect(FormatPersonName("mARIA  da silva")).toBe("Maria Da Silva");
  expect(SplitName("  Maria da  Silva ")).toEqual({ firstName: "Maria", lastName: "da Silva" });
  expect(SplitName("Maria")).toEqual({ firstName: "Maria", lastName: "" });
});

test("SafeRedirect keeps only internal paths", () => {
  expect(SafeRedirect("/eventos/1")).toBe("/eventos/1");
  expect(SafeRedirect(null)).toBe("/");
  expect(SafeRedirect("//evil.com")).toBe("/");
  expect(SafeRedirect("/\\evil.com")).toBe("/");
  expect(SafeRedirect("https://evil.com")).toBe("/");
});

describe("ValidateEmail", () => {
  test("accepts an address and refuses anything else", () => {
    expect(ValidateEmail(" maria@uefs.br ")).toBeNull();
    expect(ValidateEmail("")).toBe("Informe um e-mail válido.");
    expect(ValidateEmail("maria@")).toBe("Informe um e-mail válido.");
  });
});

describe("ValidateNewPassword", () => {
  test("a long enough password typed twice is fine", () => {
    expect(ValidateNewPassword("nova-senha-1", "nova-senha-1")).toEqual({});
  });

  test("too short, and a confirmation that doesn't match, are pointed out separately", () => {
    expect(ValidateNewPassword("curta", "curta")).toEqual({ password: "A senha precisa ter pelo menos 8 caracteres." });
    expect(ValidateNewPassword("nova-senha-1", "nova-senha-2")).toEqual({ confirmation: "As senhas não são iguais." });
    expect(ValidateNewPassword("", "x")).toEqual({
      password: "A senha precisa ter pelo menos 8 caracteres.",
      confirmation: "As senhas não são iguais.",
    });
  });
});
