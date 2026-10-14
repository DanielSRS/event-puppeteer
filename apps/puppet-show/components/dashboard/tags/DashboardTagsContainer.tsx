/**
 * Suggested tags page (Moderator+): lists every tag and promotes a free-form
 * one to a public tag after confirmation.
 *
 * Tags are system-wide, but the page lives in an organization context because
 * promoting is a moderator action recorded in that organization's audit trail.
 * The page header is drawn by the route.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Tag } from "@/lib/api/schemas";
import { tagsQuery } from "@/lib/query/queries";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
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

/** Every tag, as the review list shows them. */
export const tagReviewQuery = () => LoadedQuery(["dashboard", "tags"], LoadTags, Freshness.short);

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
  const client = useQueryClient();
  const loaded = useLoaded(tagReviewQuery());
  const tags = loaded.result;
  const [confirming, setConfirming] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [status, setStatus] = useState("");

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
    loaded.update((list) => list.map((tag) => tag.id === promoted.id ? promoted : tag));
    void client.invalidateQueries({ queryKey: tagsQuery().queryKey });
    setStatus(`A tag “${promoted.name}” agora é pública e pode ser usada como filtro no mural.`);
    setConfirming(null);
  };

  if (tags === null) return <LoadingMessage>Carregando tags...</LoadingMessage>;
  if (!tags.ok) return <ErrorAlert>{tags.error}</ErrorAlert>;

  return (
    <div className="column gap-[22px]">
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
