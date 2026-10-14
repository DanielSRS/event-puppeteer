/**
 * Screening Policy page (Superadmin, global context): loads the policy, says
 * when none is set yet (every Image then waits in Image Review) and saves
 * changes. Images already screened keep their state.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { ScreeningPolicy } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { ScreeningPolicyForm } from "./ScreeningPolicyForm";

/** Loads the policy in force (`null` while none was set). */
async function LoadPolicy(): Promise<Result<ScreeningPolicy | null, string>> {
  const answer = await api.screeningPolicy.get();
  if (!answer.ok) return Err(`Não foi possível carregar a política de triagem. ${ApiErrorMessage(answer.error)}`);
  return Ok(answer.value.policy);
}

/** The policy in force, as the page shows it. */
export const screeningPolicyQuery = () => LoadedQuery(["dashboard", "global-screening"], LoadPolicy, Freshness.short);

/** The page, guarded by the section rules. */
export function GlobalScreeningContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-screening", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  return <Screening />;
}

/** The policy and its form. */
function Screening() {
  const loaded = useLoaded(screeningPolicyQuery());
  const policy = loaded.result;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const save = async (next: ScreeningPolicy) => {
    setSaving(true);
    setError("");
    setStatus("");
    const answer = await api.screeningPolicy.set(next);
    setSaving(false);
    if (!answer.ok) return setError(`Não foi possível salvar a política. ${ApiErrorMessage(answer.error)}`);
    loaded.update(() => answer.value);
    setStatus("Política de triagem salva. Ela vale para as próximas imagens enviadas.");
  };

  if (policy === null) return <LoadingMessage>Carregando política de triagem...</LoadingMessage>;
  if (!policy.ok) return <ErrorAlert>{policy.error}</ErrorAlert>;

  return (
    <div className="column gap-4 max-w-2xl">
      {policy.value === null && (
        <p className="rounded-lg border border-main/40 bg-main/10 p-3 text-sm">
          Nenhuma política definida ainda: enquanto isso, toda imagem enviada aguarda revisão humana.
        </p>
      )}
      <StatusMessage>{status}</StatusMessage>
      <ScreeningPolicyForm policy={policy.value} saving={saving} error={error} onSave={(next) => void save(next)} />
    </div>
  );
}
