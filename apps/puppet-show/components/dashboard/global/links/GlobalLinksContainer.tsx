/**
 * Link labels page (Superadmin, global context): lists the names event links
 * can have and creates new ones. A name that already exists (ignoring case)
 * is refused by the API with 409.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { LinkLabel } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { NameCatalog } from "../NameCatalog";

/** Loads every link label. */
async function LoadLabels(): Promise<Result<LinkLabel[], string>> {
  const labels = await api.linkLabels.list();
  if (!labels.ok) return Err(`Não foi possível carregar os rótulos. ${ApiErrorMessage(labels.error)}`);
  return Ok(labels.value);
}

/** The page, guarded by the section rules. */
export function GlobalLinksContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-links", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  return <LinkLabels />;
}

/** The labels and their creation form. */
function LinkLabels() {
  const [labels, setLabels] = useState<Result<LinkLabel[], string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    LoadLabels().then((result) => { if (active) setLabels(result); });
    return () => { active = false; };
  }, []);

  const handleCreate = async (name: string): Promise<boolean> => {
    setSaving(true);
    setError("");
    setStatus("");
    const created = await api.linkLabels.create(name);
    setSaving(false);

    if (!created.ok) {
      setError(created.error.kind === "http" && created.error.status === 409
        ? "Já existe um rótulo com esse nome."
        : `Não foi possível criar o rótulo. ${ApiErrorMessage(created.error)}`);
      return false;
    }
    const label = created.value;
    setLabels((current) => current !== null && current.ok ? Ok([...current.value, label]) : current);
    setStatus(`Rótulo “${label.name}” criado.`);
    return true;
  };

  if (labels === null) return <LoadingMessage>Carregando rótulos...</LoadingMessage>;
  if (!labels.ok) return <ErrorAlert>{labels.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <NameCatalog
        title="Rótulos de links"
        inputLabel="Nome do novo rótulo"
        placeholder="Ex.: Transmissão ao vivo"
        submitLabel="Criar rótulo"
        emptyText="Nenhum rótulo cadastrado."
        items={labels.value}
        saving={saving}
        error={error}
        onCreate={handleCreate}
      />
    </div>
  );
}
