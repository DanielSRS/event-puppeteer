/**
 * Screening Policy page (Superadmin, global context): loads the policy, says
 * when none is set yet (every Image then waits in Image Review) and saves
 * changes. Images already screened keep their state. The page header is
 * drawn here, in every state, followed by the legend of the range bars.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdWarningAmber } from "react-icons/md";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { ScreeningPolicy } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { GlobalPage } from "../global-page";
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
  return (
    <GlobalPage
      title="Política de Triagem"
      description="Toda imagem enviada recebe uma nota de 0 a 100% em cada categoria. Abaixo do primeiro limite ela é aprovada; entre os dois, espera revisão humana; a partir do segundo, é recusada. Vale para as próximas imagens de todas as organizações."
    >
      {denial !== null ? <AccessNotice denial={denial} /> : <Screening />}
    </GlobalPage>
  );
}

/** What each color of the range bars means. */
function Legend() {
  const entries = [["bg-[var(--ok)]", "Aprovada"], ["bg-[var(--warn)]", "Em revisão"], ["bg-[var(--bad)]", "Recusada"]] as const;
  return (
    <div className="flex flex-wrap gap-[18px] text-[13px]">
      {entries.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <span aria-hidden className={`h-3 w-3 rounded ${color}`} />{label}
        </span>
      ))}
    </div>
  );
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
    <div className="column gap-[22px]">
      {policy.value === null && (
        <p className="notice n-warn">
          <MdWarningAmber aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
          <span>Nenhuma política definida ainda: enquanto isso, toda imagem enviada aguarda revisão humana.</span>
        </p>
      )}
      <StatusMessage>{status}</StatusMessage>
      <Legend />
      <ScreeningPolicyForm policy={policy.value} saving={saving} error={error} onSave={(next) => void save(next)} />
    </div>
  );
}
