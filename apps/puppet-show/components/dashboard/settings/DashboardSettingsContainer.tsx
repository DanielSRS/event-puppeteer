/**
 * Organization settings page (Admin+, and a Superadmin inside an
 * organization): edits the organization's profile and its report threshold.
 * Only changed fields are sent, so the threshold change is audited only when
 * it really changed.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Organization, OrganizationInput } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { OrganizationForm } from "./OrganizationForm";

/** Loads the organization being managed. */
async function LoadOrganization(orgId: string): Promise<Result<Organization, string>> {
  const org = await api.organizations.get(orgId);
  if (!org.ok) return Err(`Não foi possível carregar a organização. ${ApiErrorMessage(org.error)}`);
  return Ok(org.value);
}

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
  const [org, setOrg] = useState<Result<Organization, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let active = true;
    LoadOrganization(orgId).then((result) => { if (active) setOrg(result); });
    return () => { active = false; };
  }, [orgId]);

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
    setOrg(Ok(updated.value));
    setSaved(changes.shadowBanThreshold === undefined
      ? "Configurações salvas."
      : `Configurações salvas. Novo limite: ${updated.value.shadowBanThreshold} ${updated.value.shadowBanThreshold === 1 ? "denúncia" : "denúncias"}.`);
  };

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
    </div>
  );
}
