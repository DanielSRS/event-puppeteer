/**
 * Suggested tags page (Moderator+): lists every tag and promotes a free-form
 * one to a public tag after confirmation.
 *
 * Tags are system-wide, but the page lives in an organization context because
 * promoting is a moderator action recorded in that organization's audit trail.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Tag } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { TagManager } from "./TagManager";

/** Loads every tag. */
async function LoadTags(): Promise<Result<Tag[], string>> {
  const tags = await api.tags.list();
  if (!tags.ok) return Err(`Não foi possível carregar as tags. ${ApiErrorMessage(tags.error)}`);
  return Ok(tags.value);
}

/** The page, guarded by the section rules. */
export function DashboardTagsContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("tags", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <TagReview key={orgId} />;
}

/** The review list; remounted when the organization changes. */
function TagReview() {
  const [tags, setTags] = useState<Result<Tag[], string> | null>(null);
  const [confirming, setConfirming] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    LoadTags().then((result) => { if (active) setTags(result); });
    return () => { active = false; };
  }, []);

  const handleConfirm = async () => {
    if (confirming === null) return;
    setBusy(true);
    setDialogError("");
    const result = await api.tags.promote(confirming.id);
    setBusy(false);

    if (!result.ok) {
      setDialogError(`Não foi possível promover a tag. ${ApiErrorMessage(result.error)}`);
      return;
    }

    const promoted = result.value;
    setTags((current) => current !== null && current.ok
      ? Ok(current.value.map((tag) => tag.id === promoted.id ? promoted : tag))
      : current);
    setStatus(`A tag “${promoted.name}” agora é pública e pode ser usada como filtro no mural.`);
    setConfirming(null);
  };

  if (tags === null) return <LoadingMessage>Carregando tags...</LoadingMessage>;
  if (!tags.ok) return <ErrorAlert>{tags.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <TagManager
        tags={tags.value}
        busyTagId={busy && confirming !== null ? confirming.id : null}
        onPromote={(tag) => { setDialogError(""); setStatus(""); setConfirming(tag); }}
      />
      <ConfirmDialog
        isOpen={confirming !== null}
        title="Promover esta tag?"
        confirmLabel="Sim, promover"
        busy={busy}
        error={dialogError}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      >
        {confirming !== null && (
          <p>
            “{confirming.name}” passará a ser uma tag pública, visível como filtro no mural de todas as organizações.
            Não há como desfazer pelo painel.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
