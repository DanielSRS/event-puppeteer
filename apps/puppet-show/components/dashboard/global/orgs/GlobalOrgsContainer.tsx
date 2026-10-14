/**
 * Organizations page (Superadmin, global context): lists every organization
 * and creates or edits them in a side panel with every field the API accepts.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiErrorMessage, type ApiError } from "@/lib/api/client";
import { SortByName } from "@/utils/text";
import type { Organization, OrganizationInput } from "@/lib/api/schemas";
import { organizationQuery, organizationsQuery } from "@/lib/query/queries";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { OrganizationForm } from "../../settings/OrganizationForm";
import { OrgManager, OrgsHeader } from "./OrgManager";

/** What the side panel is doing. */
type Editing = { kind: "closed" } | { kind: "create" } | { kind: "edit"; org: Organization };

/** Loads every organization. */
async function LoadOrganizations(): Promise<Result<Organization[], string>> {
  const orgs = await api.organizations.list();
  if (!orgs.ok) return Err(`Não foi possível carregar as organizações. ${ApiErrorMessage(orgs.error)}`);
  return Ok(SortByName(orgs.value));
}

/** Every organization, sorted by name, as the page lists them. */
export const organizationListQuery = () => LoadedQuery(["dashboard", "global-orgs"], LoadOrganizations, Freshness.short);

/** Message for a failed save; a 409 means the slug is taken. */
function SaveErrorMessage(error: ApiError): string {
  if (error.kind === "http" && error.status === 409) return "Já existe uma organização com esse identificador.";
  return `Não foi possível salvar a organização. ${ApiErrorMessage(error)}`;
}

/** The page, guarded by the section rules. */
export function GlobalOrgsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-orgs", user, orgId);
  if (denial !== null) return <><OrgsHeader /><AccessNotice denial={denial} /></>;
  return <Organizations />;
}

/** List and editor of organizations. */
function Organizations() {
  const client = useQueryClient();
  const loaded = useLoaded(organizationListQuery());
  const orgs = loaded.result;
  const [editing, setEditing] = useState<Editing>({ kind: "closed" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");

  const open = (next: Editing) => { setSaveError(""); setStatus(""); setEditing(next); };

  /** Applies a save result to the list. */
  const finish = (result: Awaited<ReturnType<typeof api.organizations.create>>, verb: string) => {
    setSaving(false);
    if (!result.ok) { setSaveError(SaveErrorMessage(result.error)); return; }
    const saved = result.value;
    loaded.update((list) => SortByName(list.some((o) => o.id === saved.id) ? list.map((o) => o.id === saved.id ? saved : o) : [...list, saved]));
    client.setQueryData(organizationQuery(saved.id).queryKey, Ok(saved));
    void client.invalidateQueries({ queryKey: organizationsQuery().queryKey });
    setStatus(`Organização “${saved.name}” ${verb}.`);
    setEditing({ kind: "closed" });
  };

  const handleCreate = async (body: OrganizationInput) => {
    setSaving(true);
    setSaveError("");
    finish(await api.organizations.create(body), "criada");
  };

  const handleUpdate = async (id: string, changes: Partial<OrganizationInput>) => {
    setSaving(true);
    setSaveError("");
    finish(await api.organizations.update(id, changes), "atualizada");
  };

  if (orgs === null) return <><OrgsHeader /><LoadingMessage>Carregando organizações...</LoadingMessage></>;
  if (!orgs.ok) return <><OrgsHeader /><ErrorAlert>{orgs.error}</ErrorAlert></>;

  const editingId = editing.kind === "edit" ? editing.org.id : null;
  const takenSlugs = orgs.value.filter((o) => o.id !== editingId).map((o) => o.slug);
  const close = () => { if (!saving) setEditing({ kind: "closed" }); };

  return (
    <div className="column gap-4">
      <OrgManager organizations={orgs.value} onCreate={() => open({ kind: "create" })} onEdit={(org) => open({ kind: "edit", org })}
        notice={<StatusMessage>{status}</StatusMessage>}
      />

      <Drawer
        isOpen={editing.kind !== "closed"}
        onClose={close}
        title={editing.kind === "edit" ? `Editar ${editing.org.name}` : "Nova organização"}
        width="lg"
      >
        {editing.kind === "create" && (
          <OrganizationForm
            mode="create"
            slugEditable
            takenSlugs={takenSlugs}
            saving={saving}
            error={saveError}
            onCreate={handleCreate}
            onCancel={close}
          />
        )}
        {editing.kind === "edit" && (
          <OrganizationForm
            key={editing.org.id}
            mode="edit"
            original={editing.org}
            slugEditable
            takenSlugs={takenSlugs}
            saving={saving}
            error={saveError}
            onUpdate={(changes) => handleUpdate(editing.org.id, changes)}
            onCancel={close}
          />
        )}
      </Drawer>
    </div>
  );
}
