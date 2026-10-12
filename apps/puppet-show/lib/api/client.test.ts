import { expect, test } from "vitest";
import { ApiErrorMessage } from "./client";

test("an Image error code gets its own message, whatever the status", () => {
  expect(ApiErrorMessage({ kind: "http", status: 400, message: "Image is not in the required proportion", code: "IMAGE_WRONG_PROPORTION", path: "/x" }))
    .toBe("A imagem não está na proporção exigida. Recorte-a antes de enviar.");
  expect(ApiErrorMessage({ kind: "http", status: 429, message: "Daily image upload limit reached", code: "IMAGE_DAILY_LIMIT", path: "/x" }))
    .toBe("Você atingiu o limite de 10 imagens por dia. Tente de novo amanhã.");
});

test("without a known code the status decides", () => {
  expect(ApiErrorMessage({ kind: "http", status: 409, message: null, code: null, path: "/x" })).toBe("Já existe um registro com esses dados.");
  expect(ApiErrorMessage({ kind: "http", status: 400, message: "x", code: "SOMETHING_NEW", path: "/x" }))
    .toBe("Os dados enviados foram recusados pelo servidor. Revise o formulário.");
});
