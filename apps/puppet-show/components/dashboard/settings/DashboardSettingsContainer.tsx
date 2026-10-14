/**
 * Organization settings page (Admin+, and a Superadmin inside an
 * organization): edits the organization's profile and its report threshold.
 * Only changed fields are sent, so the threshold change is audited only when
 * it really changed. The logo is uploaded and removed on its own.
 *
 * Layout: the page header (drawn here in every state, so the `<h1>` is always
 * there), then the form's cards beside the logo card (stacked when narrow).
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Organization, OrganizationInput } from "@/lib/api/schemas";
import { organizationQuery } from "@/lib/query/queries";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { PageHeader } from "../page-header";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { OrganizationForm } from "./OrganizationForm";
import { LogoPanel } from "./LogoPanel";

/** Loads the organization being managed. */
async function LoadOrganization(orgId: string): Promise<Result<Organization, string>> {
  const org = await api.organizations.get(orgId);
  if (!org.ok) return Err(`Não foi possível carregar a organização. ${ApiErrorMessage(org.error)}`);
  return Ok(org.value);
}

/** The organization being managed, as the settings page edits it. */
export const settingsQuery = (orgId: string) =>
  LoadedQuery(["dashboard", "settings", orgId], () => LoadOrganization(orgId), Freshness.short);

/** Title and description; names the organization once it is loaded. */
function SettingsHeader({ orgName }: { orgName?: string }) {
  return (
    <PageHeader
      title="Configurações"
      description={`Como ${orgName ?? "a organização"} aparece no mural, nos totens e no Painel, e o limite de denúncias para ocultar eventos automaticamente.`}
    />
  );
}

/** The page, guarded by the section rules. */
export function DashboardSettingsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("settings", user, orgId);
  if (denial !== null) return <><SettingsHeader /><AccessNotice denial={denial} /></>;
  if (orgId === null) return <><SettingsHeader /><SelectOrgNotice /></>;
  return <Settings key={orgId} orgId={orgId} />;
}

/** The settings of one organization; remounted when the organization changes. */
function Settings({ orgId }: { orgId: string }) {
  const client = useQueryClient();
  const loaded = useLoaded(settingsQuery(orgId));
  const org = loaded.result;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoNotice, setLogoNotice] = useState("");
  const [logoError, setLogoError] = useState("");

  /** Shows `next` here and wherever else the organization is shown (the top bar's name and logo). */
  const showOrganization = (next: Organization) => {
    loaded.update(() => next);
    client.setQueryData(organizationQuery(orgId).queryKey, Ok(next));
  };

  const handleUpdate = async (changes: Partial<OrganizationInput>) => {
    setSaving(true);
    setSaveError("");
    setSaved("");
    const updated = await api.organizations.update(orgId, changes);
    setSaving(false);

    if (!updated.ok) {
      setSaveError(`Não foi possível salvar. ${ApiErrorMessage(updated.error)}`);
      return;
    }
    showOrganization(updated.value);
    setSaved(changes.shadowBanThreshold === undefined
      ? "Configurações salvas."
      : `Configurações salvas. Novo limite: ${updated.value.shadowBanThreshold} ${updated.value.shadowBanThreshold === 1 ? "denúncia" : "denúncias"}.`);
  };

  /** Sends a logo change and applies the logo the API answers. */
  const changeLogo = async (send: () => Promise<{ ok: true; logo: Organization["logo"] } | { ok: false; error: string }>, notice: string) => {
    setLogoBusy(true);
    setLogoNotice("");
    setLogoError("");
    const result = await send();
    setLogoBusy(false);
    if (!result.ok) return setLogoError(result.error);
    if (org !== null && org.ok) showOrganization({ ...org.value, logo: result.logo });
    setLogoNotice(notice);
  };

  const uploadLogo = (picture: Blob) => changeLogo(async () => {
    const answer = await api.images.uploadLogo(orgId, picture);
    return answer.ok ? { ok: true, logo: answer.value } : { ok: false, error: `Não foi possível enviar o logo. ${ApiErrorMessage(answer.error)}` };
  }, "Logo atualizado.");

  const removeLogo = () => changeLogo(async () => {
    const answer = await api.images.removeLogo(orgId);
    return answer.ok ? { ok: true, logo: undefined } : { ok: false, error: `Não foi possível remover o logo. ${ApiErrorMessage(answer.error)}` };
  }, "Logo removido.");

  if (org === null) return <><SettingsHeader /><LoadingMessage>Carregando configurações...</LoadingMessage></>;
  if (!org.ok) return <><SettingsHeader /><ErrorAlert>{org.error}</ErrorAlert></>;

  return (
    <>
      <SettingsHeader orgName={org.value.name} />
      <StatusMessage>{saved}</StatusMessage>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_480px]">
          <OrganizationForm
            key={org.value.updatedAt}
            mode="edit"
            layout="cards"
            original={org.value}
            slugEditable={false}
            takenSlugs={[]}
            saving={saving}
            error={saveError}
            onUpdate={handleUpdate}
          />
        </div>
        <LogoPanel
          className="flex-[1_1_280px]"
          orgName={org.value.name}
          logo={org.value.logo === undefined ? null : org.value.logo}
          busy={logoBusy}
          notice={logoNotice}
          error={logoError}
          onUpload={(picture) => void uploadLogo(picture)}
          onRemove={() => void removeLogo()}
        />
      </div>
    </>
  );
}
