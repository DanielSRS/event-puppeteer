import { describe, expect, test } from "vitest";
import { AuditEntrySchema, type AuditEntry } from "@/lib/api/schemas";
import { Err, Ok } from "@/lib/result";
import { DescribeTarget, FormatAuditDetails, NewestFirst, ToAuditRow, type AuditLookups } from "./auditFormat";

/** Lookups that know one user, one event and one tag; anything else fails. */
const lookups: AuditLookups = {
  user: (id) => id === "u1" ? Ok("Ana Admin (admin@x.org)") : Err(`não encontrado (${id})`),
  event: (id) => id === "e1" ? Ok("“Feira de Ciências”") : Err(`não carregado (${id})`),
  tag: (id) => id === "t1" ? Ok("“robotica”") : Err(`não encontrada (${id})`),
};

/** An entry with sensible defaults. */
function entry(fields: Partial<AuditEntry>): AuditEntry {
  return { id: "a1", action: "hide_event", targetType: "event", targetId: "e1", createdAt: "2026-10-07T12:00:00Z", ...fields };
}

describe("FormatAuditDetails", () => {
  test("no details, no sentences", () => expect(FormatAuditDetails(undefined, lookups)).toEqual([]));

  test("automatic shadow ban names the reason and the event", () => {
    expect(FormatAuditDetails({ reason: "auto_threshold_reached", eventId: "e1" }, lookups)).toEqual([
      Ok("Motivo: o evento atingiu o limite de denúncias da organização."),
      Ok("Evento que motivou: “Feira de Ciências”"),
    ]);
  });

  test("an event that can't be looked up stays a failure", () => {
    expect(FormatAuditDetails({ eventId: "gone" }, lookups)).toEqual([Err("Evento que motivou: não carregado (gone)")]);
  });

  test("threshold and removal counts in Portuguese", () => {
    expect(FormatAuditDetails({ shadowBanThreshold: 1 }, lookups)).toEqual([Ok("Novo limite: 1 denúncia para ocultar um evento.")]);
    expect(FormatAuditDetails({ shadowBanThreshold: 3 }, lookups)).toEqual([Ok("Novo limite: 3 denúncias para ocultar um evento.")]);
    expect(FormatAuditDetails({ deletedEvents: 0 }, lookups)).toEqual([Ok("0 eventos excluídos junto com a conta.")]);
    expect(FormatAuditDetails({ deletedEvents: 1 }, lookups)).toEqual([Ok("1 evento excluído junto com a conta.")]);
  });

  test("a role change names the old and the new role", () => {
    expect(FormatAuditDetails({ from: "Member", to: "Superadmin" }, lookups)).toEqual([
      Ok("Papel anterior: Membro."),
      Ok("Novo papel: Superadmin."),
    ]);
  });

  test("an unknown role value is labelled, not translated", () => {
    expect(FormatAuditDetails({ to: "Root" }, lookups)).toEqual([Ok("Informação adicional “to”: Root.")]);
  });

  test("unknown details are labelled, not dumped", () => {
    expect(FormatAuditDetails({ reason: "manual", extra: { a: 1 } }, lookups)).toEqual([
      Ok("Motivo: manual."),
      Ok("Informação adicional “extra”: {\"a\":1}."),
    ]);
  });
});

describe("DescribeTarget", () => {
  test("each target type", () => {
    expect(DescribeTarget({ targetType: "event", targetId: "e1" }, lookups)).toEqual(Ok("Evento “Feira de Ciências”"));
    expect(DescribeTarget({ targetType: "user", targetId: "u1" }, lookups)).toEqual(Ok("Usuário Ana Admin (admin@x.org)"));
    expect(DescribeTarget({ targetType: "tag", targetId: "t1" }, lookups)).toEqual(Ok("Tag “robotica”"));
    expect(DescribeTarget({ targetType: "organization", targetId: "o1" }, lookups)).toEqual(Ok("Esta organização"));
  });

  test("failed lookups and unknown types are failures", () => {
    expect(DescribeTarget({ targetType: "user", targetId: "u9" }, lookups)).toEqual(Err("Usuário não encontrado (u9)"));
    expect(DescribeTarget({ targetType: "device", targetId: "d1" }, lookups)).toEqual(Err("Tipo de alvo desconhecido “device” (d1)"));
  });
});

describe("ToAuditRow", () => {
  test("no actor means automatic", () => {
    const row = ToAuditRow(entry({ details: { reason: "auto_threshold_reached" } }), lookups);
    expect(row.actor).toEqual({ kind: "automatic" });
    expect(row.actionLabel).toBe("Evento ocultado");
  });

  test("an actor is looked up", () => {
    const row = ToAuditRow(entry({ actorId: "u1", action: "remove_user", targetType: "user", targetId: "u9" }), lookups);
    expect(row.actor).toEqual({ kind: "user", name: Ok("Ana Admin (admin@x.org)") });
    expect(row.actionLabel).toBe("Usuário removido");
    expect(row.target).toEqual(Err("Usuário não encontrado (u9)"));
  });
});

describe("NewestFirst", () => {
  test("sorts by creation, newest first", () => {
    const sorted = NewestFirst([entry({ id: "old", createdAt: "2026-01-01T00:00:00Z" }), entry({ id: "new", createdAt: "2026-02-01T00:00:00Z" })]);
    expect(sorted.map((e) => e.id)).toEqual(["new", "old"]);
  });
});

describe("Image Review entries", () => {
  test("the API's audit list with Image decisions is accepted", () => {
    const answer = [
      entry({ action: "approve_image", targetType: "image", targetId: "img-1" }),
      entry({ id: "a2", action: "reject_image", targetType: "image", targetId: "img-2" }),
      entry({ id: "a3", action: "apply_shadow_ban", targetType: "user", targetId: "u1", details: { reason: "confirmed_image_rejection", imageId: "img-2" } }),
      { id: "a4", action: "update_screening_policy", targetType: "screening_policy", targetId: "screening_policy", createdAt: "2026-10-07T12:00:00Z" },
    ];
    expect(AuditEntrySchema.array().safeParse(answer).success).toBe(true);
  });

  test("a rejected Image and the shadow ban it caused read as sentences", () => {
    const rejected = ToAuditRow(entry({ action: "reject_image", targetType: "image", targetId: "img-2" }), lookups);
    expect([rejected.actionLabel, rejected.target]).toEqual(["Imagem rejeitada na revisão", Ok("Uma imagem enviada (banner ou logo)")]);
    expect(FormatAuditDetails({ reason: "confirmed_image_rejection", imageId: "img-2" }, lookups)).toEqual([
      Ok("Motivo: uma imagem enviada pela pessoa foi rejeitada na revisão de imagens."),
      Ok("A imagem rejeitada fica guardada para a moderação e nunca é exibida."),
    ]);
  });

  test("an approved Image and a Screening Policy change have their labels", () => {
    expect(ToAuditRow(entry({ action: "approve_image", targetType: "image", targetId: "img-1" }), lookups).actionLabel).toBe("Imagem aprovada na revisão");
    const policy = ToAuditRow(entry({ action: "update_screening_policy", targetType: "screening_policy", targetId: "screening_policy" }), lookups);
    expect([policy.actionLabel, policy.target]).toEqual(["Política de triagem alterada", Ok("A política de triagem de imagens")]);
  });
});
