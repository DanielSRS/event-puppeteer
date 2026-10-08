/**
 * Official tags page (Superadmin, global context): lists the system-defined
 * tags and creates new ones. A name that already exists (official or
 * free-form, ignoring case) is refused by the API with 409.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Tag } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { NameCatalog } from "../NameCatalog";

/** Loads every tag. */
async function LoadTags(): Promise<Result<Tag[], string>> {
  const tags = await api.tags.list();
  if (!tags.ok) return Err(`Não foi possível carregar as tags. ${ApiErrorMessage(tags.error)}`);
  return Ok(tags.value);
}

/** The page, guarded by the section rules. */
export function GlobalTagsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-tags", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  return <GlobalTags />;
}

/** The official tags and their creation form. */
function GlobalTags() {
  const [tags, setTags] = useState<Result<Tag[], string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    LoadTags().then((result) => { if (active) setTags(result); });
    return () => { active = false; };
  }, []);

  const handleCreate = async (name: string): Promise<boolean> => {
    setSaving(true);
    setError("");
    setStatus("");
    const created = await api.tags.create(name, true);
    setSaving(false);

    if (!created.ok) {
      setError(created.error.kind === "http" && created.error.status === 409
        ? "Já existe uma tag com esse nome (oficial ou sugerida). Se for uma sugestão, promova-a em Tags Sugeridas dentro de uma organização."
        : `Não foi possível criar a tag. ${ApiErrorMessage(created.error)}`);
      return false;
    }
    const tag = created.value;
    setTags((current) => current !== null && current.ok ? Ok([...current.value, tag]) : current);
    setStatus(`Tag “${tag.name}” criada.`);
    return true;
  };

  if (tags === null) return <LoadingMessage>Carregando tags...</LoadingMessage>;
  if (!tags.ok) return <ErrorAlert>{tags.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <NameCatalog
        title="Tags oficiais"
        inputLabel="Nome da nova tag"
        placeholder="Ex.: Esportes"
        submitLabel="Criar tag"
        emptyText="Nenhuma tag oficial ainda."
        items={tags.value.filter((tag) => tag.isSystemDefined)}
        saving={saving}
        error={error}
        onCreate={handleCreate}
      />
    </div>
  );
}
