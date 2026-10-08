/**
 * Admin pages against the real API, in the order a moderation day happens:
 * the report queue, the automatic threshold and the bans it causes, tag
 * promotion, people management, the audit trail of all that, devices, and
 * the Superadmin's global pages. Desktop; `dashboard-admin-mobile.spec.ts`
 * checks every page on a phone.
 *
 * The tests share state on purpose (the audit test reads what the earlier ones
 * did), so they run in this order. Seed data other specs rely on is restored:
 * "Feira de Ciências" ends visible and the threshold goes back to 5. The
 * seeded free-form tag "robotica" is not promoted (public-feed.spec expects it
 * to stay private); a tag created here is promoted instead.
 *
 * @module
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Api, CloseBrowser, LoginAs, OpenPage, State } from "../support.ts";
import type { E2EState } from "../config.ts";
import {
  ADMIN_PATHS, CallAs, CardOf, Finish, LoginStatus, OpenAdminPage, RefusedRequest, RegisterPerson, WarmUp, type Person,
} from "./dashboard-admin-support.ts";

after(CloseBrowser);

/** A 64-character hex digest for the update command. */
const SHA = "0123456789abcdef".repeat(4);

describe("Painel admin: fluxos de moderação, administração e superadmin (desktop)", () => {
  let state: E2EState;
  let author: Person;
  let roleTarget: Person;
  let removed: Person;
  const suffix = Date.now().toString(36);

  before(async () => {
    state = await State();
    await WarmUp([...ADMIN_PATHS, `/dashboard/devices/${state.activeDeviceId}`]);
    const org = state.orgA.id;
    author = await RegisterPerson(org, "Autor", "Limite", `autor.${suffix}@e2e.test`);
    roleTarget = await RegisterPerson(org, "Paula", "Papel", `paula.${suffix}@e2e.test`);
    removed = await RegisterPerson(org, "Rita", "Removida", `rita.${suffix}@e2e.test`);
  });

  test("moderador vê a denúncia da Feira de Ciências, oculta e o estado continua certo após recarregar; depois reexibe", async () => {
    const tp = await OpenPage("desktop");
    const { page } = tp;
    await LoginAs(page, "moderator", "/dashboard/reports");
    let main = await OpenAdminPage(page, "/dashboard/reports", "Denúncias");

    let card = CardOf(main, "Feira de Ciências");
    await card.getByText(/1 denúncia/).waitFor();
    await card.getByText("Spam (1)").waitFor();
    await card.getByText("“Parece propaganda”").waitFor();
    await card.getByText("Visível no mural").waitFor();
    assert.equal(await main.getByRole("button", { name: /Resolver/ }).count(), 0, "no fake resolve button");

    await card.getByRole("button", { name: "Ocultar evento Feira de Ciências" }).click();
    await main.getByRole("status").filter({ hasText: "“Feira de Ciências” foi ocultado do mural." }).waitFor();

    await page.reload();
    main = await OpenAdminPage(page, "/dashboard/reports", "Denúncias");
    card = CardOf(main, "Feira de Ciências");
    await card.getByText("Oculto do mural").waitFor();
    await card.getByRole("button", { name: "Reexibir evento Feira de Ciências" }).click();
    await main.getByRole("status").filter({ hasText: "voltou a aparecer no mural" }).waitFor();
    await card.getByText("Visível no mural").waitFor();

    await Finish(tp, false);
  });

  test("limite de denúncias: admin define 2, duas denúncias ocultam o evento e banem o autor; moderador remove o banimento", async () => {
    const admin = await OpenPage("desktop");
    await LoginAs(admin.page, "admin", "/dashboard/settings");
    const settings = await OpenAdminPage(admin.page, "/dashboard/settings", "Configurações");
    const threshold = settings.getByLabel("Limite de denúncias");
    await threshold.fill("");
    await settings.getByRole("button", { name: "Salvar alterações" }).click();
    await settings.getByText("Informe um número inteiro de denúncias, a partir de 1.").waitFor();
    await threshold.fill("2");
    await settings.getByRole("button", { name: "Salvar alterações" }).click();
    await settings.getByRole("status").filter({ hasText: "Novo limite: 2 denúncias." }).waitFor();
    await Finish(admin, false);

    const org = state.orgA.id;
    const title = `Evento Denunciado ${suffix}`;
    const { id: eventId } = await CallAs(author.token, "POST", `/organizations/${org}/events`, {
      title, description: "Evento criado para o teste do limite.", location: "Pátio", isHidden: false,
      schedule: [{ date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }], tags: [], links: [],
    }) as { id: string };
    await Api("reporter", "POST", `/organizations/${org}/events/${eventId}/report`, { reason: "spam", comment: "Propaganda" });
    await Api("member", "POST", `/organizations/${org}/events/${eventId}/report`, { reason: "offensive_content" });

    const moderator = await OpenPage("desktop");
    await LoginAs(moderator.page, "moderator", "/dashboard/reports");
    const reports = await OpenAdminPage(moderator.page, "/dashboard/reports", "Denúncias");
    const card = CardOf(reports, title);
    await card.getByText(/2 denúncias/).waitFor();
    await card.getByText("Oculto do mural").waitFor();

    const bans = await OpenAdminPage(moderator.page, "/dashboard/bans", "Usuários Banidos");
    await bans.getByRole("heading", { name: "Autor Limite" }).waitFor();
    await bans.getByRole("button", { name: "Remover banimento de Autor Limite" }).click();
    const dialog = moderator.page.getByRole("alertdialog", { name: "Remover o banimento?" });
    await dialog.getByRole("button", { name: "Sim, remover banimento" }).click();
    await bans.getByRole("status").filter({ hasText: "Banimento de Autor Limite removido." }).waitFor();
    assert.equal(await bans.getByRole("heading", { name: "Autor Limite" }).count(), 0);
    await Finish(moderator, false);

    await Api("admin", "PATCH", `/organizations/${org}`, { shadowBanThreshold: 5 });
  });

  test("moderador promove uma tag sugerida com confirmação", async () => {
    const name = `drones${suffix}`;
    await Api("member", "POST", "/tags", { name, isSystemDefined: false });

    const tp = await OpenPage("desktop");
    await LoginAs(tp.page, "moderator", "/dashboard/tags");
    const main = await OpenAdminPage(tp.page, "/dashboard/tags", "Tags Sugeridas");
    await main.getByText("#robotica").waitFor();
    assert.equal(await main.getByRole("button", { name: /Rejeitar/ }).count(), 0, "no fake reject button");

    await main.getByRole("button", { name: `Promover a tag ${name}` }).click();
    await tp.page.getByRole("alertdialog", { name: "Promover esta tag?" }).getByRole("button", { name: "Sim, promover" }).click();
    await main.getByRole("status").filter({ hasText: `A tag “${name}” agora é pública` }).waitFor();

    const tags = await Api(null, "GET", "/tags") as Array<{ name: string; isSystemDefined: boolean }>;
    assert.equal(tags.find((tag) => tag.name === name)?.isSystemDefined, true);
    await Finish(tp, false);
  });

  test("admin busca pessoas, muda um papel e remove (desativa) uma conta que não consegue mais entrar", async () => {
    const tp = await OpenPage("desktop");
    const { page } = tp;
    await LoginAs(page, "admin", "/dashboard/users");
    const main = await OpenAdminPage(page, "/dashboard/users", "Usuários");
    const search = main.getByLabel("Buscar por nome");

    await search.fill("maria");
    await main.getByRole("status").filter({ hasText: "1 pessoa para “maria”." }).waitFor();
    await main.getByRole("rowheader", { name: "Maria Membro" }).waitFor();

    await search.fill("ana");
    await main.getByRole("status").filter({ hasText: "para “ana”" }).waitFor();
    assert.equal(await main.getByLabel("Papel de Ana Admin").isDisabled(), true, "own role can't be changed");
    assert.equal(await main.getByRole("button", { name: "Remover Ana Admin" }).isDisabled(), true, "can't remove yourself");

    await search.fill("paula");
    await main.getByRole("status").filter({ hasText: "para “paula”" }).waitFor();
    await main.getByLabel("Papel de Paula Papel").selectOption("Moderator");
    await main.getByRole("status").filter({ hasText: "Paula Papel agora é Moderador." }).waitFor();
    const people = await Api("admin", "GET", `/organizations/${state.orgA.id}/users?search=paula`) as Array<{ id: string; role: string }>;
    assert.equal(people.find((p) => p.id === roleTarget.id)?.role, "Moderator");

    await search.fill("rita");
    await main.getByRole("status").filter({ hasText: "para “rita”" }).waitFor();
    await main.getByRole("button", { name: "Remover Rita Removida" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Remover Rita Removida?" });
    await dialog.getByText("A pessoa não conseguirá mais entrar na conta.").waitFor();
    await dialog.getByRole("button", { name: "Sim, remover" }).click();
    await main.getByRole("status").filter({ hasText: "Rita Removida foi removido(a) da organização." }).waitFor();
    assert.notEqual(await LoginStatus(removed.email), 200, "a removed account can't log in");

    await Finish(tp, false);
  });

  test("admin vê na auditoria as ações manuais e automáticas, com nomes e detalhes em português", async () => {
    const tp = await OpenPage("desktop");
    await LoginAs(tp.page, "admin", "/dashboard/audit");
    const main = await OpenAdminPage(tp.page, "/dashboard/audit", "Auditoria");
    const table = main.getByRole("table", { name: /Registro de auditoria/ });

    for (const action of ["Evento ocultado", "Evento reexibido", "Shadow ban aplicado", "Shadow ban removido", "Tag promovida", "Limite de denúncias alterado", "Usuário removido"])
      await table.getByRole("rowheader", { name: action }).first().waitFor();

    assert.ok(await table.getByText("Automático (limite de denúncias)").count() >= 2, "automatic hide and ban");
    await table.getByText("Evento “Feira de Ciências”").first().waitFor();
    await table.getByText("Marcos Moderador (moderador@e2e.test)").first().waitFor();
    await table.getByText("Motivo: o evento atingiu o limite de denúncias da organização.").first().waitFor();
    await table.getByText("Novo limite: 2 denúncias para ocultar um evento.").waitFor();
    assert.equal(await table.getByText("auto_threshold_reached").count(), 0, "no raw details");
    await Finish(tp, false);
  });

  test("admin aprova o dispositivo pendente pelo formulário, rejeita outro e envia comandos ao ativo", async () => {
    const org = state.orgA.id;
    await Api(null, "POST", "/devices/connect", { identifier: `reject-${suffix}`, organizationId: org });

    const tp = await OpenPage("desktop");
    const { page } = tp;
    await LoginAs(page, "admin", "/dashboard/devices");
    let main = await OpenAdminPage(page, "/dashboard/devices", "Dispositivos");

    await main.getByRole("button", { name: "Aprovar pending-mac-02" }).click();
    const drawer = page.getByRole("dialog", { name: "Aprovar dispositivo" });
    await drawer.getByRole("button", { name: "Aprovar dispositivo" }).click();
    await drawer.getByText("Informe o nome do dispositivo.").waitFor();
    await drawer.getByLabel("Nome do dispositivo").fill("Totem Hall");
    await drawer.getByLabel("Localização").fill("Hall de entrada");
    await drawer.getByRole("button", { name: "Aprovar dispositivo" }).click();
    await main.getByRole("status").filter({ hasText: "Dispositivo “Totem Hall” aprovado." }).waitFor();
    await CardOf(main, "Totem Hall").getByText("pending-mac-02").waitFor();

    await main.getByRole("button", { name: `Rejeitar reject-${suffix}` }).click();
    await page.getByRole("alertdialog", { name: "Rejeitar este dispositivo?" }).getByRole("button", { name: "Sim, rejeitar" }).click();
    await main.getByRole("status").filter({ hasText: `Dispositivo reject-${suffix} rejeitado.` }).waitFor();
    await main.getByRole("button", { name: `Rejeitar reject-${suffix}` }).waitFor({ state: "detached" });

    const library = CardOf(main, "Totem Biblioteca");
    await library.getByText("active-mac-03").waitFor();
    await library.getByText(/Online|Offline/).first().waitFor();
    await library.getByRole("link", { name: "Ver detalhes de Totem Biblioteca" }).click();
    main = await OpenAdminPage(page, `/dashboard/devices/${state.activeDeviceId}`, "Dispositivo");

    for (const group of ["Hardware", "Sistema", "Puppet", "Rede", "Tela", "Modo quiosque", "Estabilidade"])
      await main.getByRole("region", { name: group }).waitFor();
    await main.getByText("51,5 °C").waitFor();
    await main.getByText("Debian 13").waitFor();
    await main.getByText("Puppet iniciado").waitFor();

    await main.getByRole("button", { name: "Reiniciar" }).click();
    await page.getByRole("alertdialog", { name: "Reiniciar o dispositivo?" }).getByRole("button", { name: "Sim, reiniciar" }).click();
    await main.getByRole("status").filter({ hasText: "Comando “Reiniciar” enviado." }).waitFor();

    await main.getByRole("button", { name: "Atualizar Puppet" }).click();
    const update = page.getByRole("dialog", { name: "Atualizar o Puppet" });
    await update.getByLabel("Endereço do Puppet").fill("puppet.bin");
    await update.getByLabel("SHA-256").fill("abc");
    await update.getByRole("button", { name: "Enviar atualização" }).click();
    await update.getByText(/Use um endereço completo/).waitFor();
    await update.getByText(/este tem 3/).waitFor();
    await update.getByLabel("Endereço do Puppet").fill("/updates/puppet-1.1.0");
    await update.getByLabel("SHA-256").fill(SHA);
    await update.getByLabel("Versão (opcional)").fill("1.1.0");
    await update.getByRole("button", { name: "Enviar atualização" }).click();
    await main.getByRole("status").filter({ hasText: "Comando “Atualizar Puppet” enviado." }).waitFor();

    const history = main.getByRole("table", { name: /Comandos enviados/ });
    await history.getByRole("rowheader", { name: "Reiniciar" }).waitFor();
    await history.getByRole("rowheader", { name: "Atualizar Puppet" }).waitFor();
    await history.getByText("Versão 1.1.0 · /updates/puppet-1.1.0").waitFor();

    await Finish(tp, false);
  });

  test("superadmin cria e edita uma organização com todos os campos, atribui o dispositivo órfão e cria tag e rótulo globais", async () => {
    const tp = await OpenPage("desktop");
    const { page } = tp;
    await LoginAs(page, "superadmin", "/dashboard/global/orgs");
    let main = await OpenAdminPage(page, "/dashboard/global/orgs", "Organizações");

    const name = `Faculdade ${suffix}`;
    await main.getByRole("button", { name: "Nova organização" }).click();
    const form = page.getByRole("dialog", { name: "Nova organização" });
    await form.getByLabel("Nome").fill(name);
    await form.getByLabel("Identificador (slug)").fill("uefs");
    await form.getByLabel("Descrição (opcional)").fill("Criada pelo teste.");
    await form.getByLabel("Endereço do logo (opcional)").fill("https://example.org/logo.png");
    await form.getByLabel("Site (opcional)").fill("https://example.org");
    await form.getByLabel("Cor principal (opcional)").fill("#16a34a");
    await form.getByLabel("Local (opcional)").fill("Salvador, BA");
    await form.getByLabel("Latitude (opcional)").fill("-12,97");
    await form.getByLabel("Longitude (opcional)").fill("-38.5");
    await form.getByLabel("Limite de denúncias").fill("4");
    await form.getByRole("button", { name: "Criar organização" }).click();
    await form.getByText("Já existe uma organização com esse identificador.").waitFor();
    await form.getByLabel("Identificador (slug)").fill(`faculdade-${suffix}`);
    await form.getByRole("button", { name: "Criar organização" }).click();
    await main.getByRole("status").filter({ hasText: `Organização “${name}” criada.` }).waitFor();

    await main.getByRole("button", { name: `Editar ${name}` }).click();
    const edit = page.getByRole("dialog", { name: `Editar ${name}` });
    await edit.getByLabel("Local (opcional)").fill("Feira de Santana, BA");
    await edit.getByRole("button", { name: "Salvar alterações" }).click();
    await main.getByRole("status").filter({ hasText: `Organização “${name}” atualizada.` }).waitFor();

    const orgs = await Api("superadmin", "GET", "/organizations") as Array<Record<string, unknown>>;
    const created = orgs.find((o) => o.name === name);
    assert.deepEqual(
      created && [created.slug, created.description, created.logo, created.url, created.colorScheme, created.location, created.latitude, created.longitude, created.shadowBanThreshold],
      [`faculdade-${suffix}`, "Criada pelo teste.", "https://example.org/logo.png", "https://example.org", "#16a34a", "Feira de Santana, BA", -12.97, -38.5, 4],
    );

    main = await OpenAdminPage(page, "/dashboard/global/devices", "Dispositivos Órfãos");
    await main.getByRole("button", { name: "Atribuir a uma organização (orphan-mac-01)" }).click();
    const assign = page.getByRole("dialog", { name: "Atribuir dispositivo" });
    await assign.getByLabel("Organização").selectOption({ label: "Universidade Estadual" });
    await assign.getByLabel("Nome do dispositivo").fill("Totem Reitoria");
    await assign.getByLabel("Localização").fill("Reitoria");
    await assign.getByRole("button", { name: "Aprovar dispositivo" }).click();
    await main.getByRole("status").filter({ hasText: "Dispositivo “Totem Reitoria” atribuído e aprovado." }).waitFor();
    const active = await Api("admin", "GET", `/organizations/${state.orgA.id}/devices`) as Array<{ name?: string }>;
    assert.ok(active.some((d) => d.name === "Totem Reitoria"));

    main = await OpenAdminPage(page, "/dashboard/global/tags", "Tags Globais");
    await main.getByLabel("Nome da nova tag").fill(`Oficina ${suffix}`);
    await main.getByRole("button", { name: "Criar tag" }).click();
    await main.getByRole("status").filter({ hasText: `Tag “Oficina ${suffix}” criada.` }).waitFor();
    await main.getByLabel("Nome da nova tag").fill("tecnologia");
    await main.getByRole("button", { name: "Criar tag" }).click();
    await main.getByRole("alert").filter({ hasText: "Já existe uma tag com esse nome" }).waitFor();
    assert.equal(await main.getByRole("button", { name: /Remover|Excluir/ }).count(), 0, "no delete buttons");

    main = await OpenAdminPage(page, "/dashboard/global/links", "Rótulos de Links");
    await main.getByLabel("Nome do novo rótulo").fill(`Transmissão ${suffix}`);
    await main.getByRole("button", { name: "Criar rótulo" }).click();
    await main.getByRole("status").filter({ hasText: `Rótulo “Transmissão ${suffix}” criado.` }).waitFor();
    await main.getByLabel("Nome do novo rótulo").fill("inscrição");
    await main.getByRole("button", { name: "Criar rótulo" }).click();
    await main.getByRole("alert").filter({ hasText: "Já existe um rótulo com esse nome." }).waitFor();

    await Finish(tp, false, [RefusedRequest(409, "Conflict"), RefusedRequest(409, "Conflict")]);
  });
});
