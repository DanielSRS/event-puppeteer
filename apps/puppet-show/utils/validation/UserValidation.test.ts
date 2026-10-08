import { expect, test } from "vitest";
import { SafeRedirect, ValidateUser } from "./UserValidation";
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
