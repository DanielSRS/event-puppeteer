/**
 * Organization settings page (Admin+, and a Superadmin inside an
 * organization): edits the organization's profile and its report threshold.
 * Only changed fields are sent, so the threshold change is audited only when
 * it really changed. The logo is uploaded and removed on its own.
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

/** The page, guarded by the section rules. */
export function DashboardSettingsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("settings", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
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

  if (org === null) return <LoadingMessage>Carregando configurações...</LoadingMessage>;
  if (!org.ok) return <ErrorAlert>{org.error}</ErrorAlert>;

  return (
    <div className="column gap-4 max-w-2xl">
      <StatusMessage>{saved}</StatusMessage>
      <div className="card">
        <OrganizationForm
          key={org.value.updatedAt}
          mode="edit"
          original={org.value}
          slugEditable={false}
          takenSlugs={[]}
          saving={saving}
          error={saveError}
          onUpdate={handleUpdate}
        />
      </div>
      <LogoPanel
        orgName={org.value.name}
        logo={org.value.logo === undefined ? null : org.value.logo}
        busy={logoBusy}
        notice={logoNotice}
        error={logoError}
        onUpload={(picture) => void uploadLogo(picture)}
        onRemove={() => void removeLogo()}
      />
    </div>
  );
}
