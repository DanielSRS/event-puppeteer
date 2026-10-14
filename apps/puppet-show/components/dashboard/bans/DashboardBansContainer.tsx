/**
 * Shadow-banned users page (Moderator+): lists the banned people of the
 * organization and lifts a ban after confirmation.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { Err, Ok, type Result } from "@/lib/result";
import { Freshness } from "@/lib/query/options";
import { LoadedQuery } from "@/lib/query/loaded";
import { useLoaded } from "@/lib/query/useLoaded";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { BanList, type BannedUser } from "./BanList";

/** Loads the banned people of `orgId`. */
async function LoadBans(orgId: string): Promise<Result<BannedUser[], string>> {
  const users = await api.moderation.listShadowBans(orgId);
  if (!users.ok) return Err(`Não foi possível carregar os usuários banidos. ${ApiErrorMessage(users.error)}`);
  return Ok(users.value.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email })));
}

/** The banned people of `orgId`. */
export const bansQuery = (orgId: string) =>
  LoadedQuery(["dashboard", "bans", orgId], () => LoadBans(orgId), Freshness.short);

/** The page, guarded by the section rules. */
export function DashboardBansContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("bans", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <Bans key={orgId} orgId={orgId} />;
}

/** The bans of one organization; remounted when the organization changes. */
function Bans({ orgId }: { orgId: string }) {
  const loaded = useLoaded(bansQuery(orgId));
  const bans = loaded.result;
  const [confirming, setConfirming] = useState<BannedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [status, setStatus] = useState("");

  const handleConfirm = async () => {
    if (confirming === null) return;
    setBusy(true);
    setDialogError("");
    const result = await api.moderation.liftShadowBan(orgId, confirming.id);
    setBusy(false);

    if (!result.ok) {
      setDialogError(`Não foi possível remover o banimento. ${ApiErrorMessage(result.error)}`);
      return;
    }

    const lifted = confirming;
    loaded.update((users) => users.filter((u) => u.id !== lifted.id));
    setStatus(`Banimento de ${lifted.name} removido. Os eventos dessa pessoa voltam a aparecer no mural.`);
    setConfirming(null);
  };

  if (bans === null) return <LoadingMessage>Carregando usuários banidos...</LoadingMessage>;
  if (!bans.ok) return <ErrorAlert>{bans.error}</ErrorAlert>;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <BanList
        users={bans.value}
        busyUserId={busy && confirming !== null ? confirming.id : null}
        onLiftBan={(user) => { setDialogError(""); setStatus(""); setConfirming(user); }}
      />
      <ConfirmDialog
        isOpen={confirming !== null}
        title="Remover o banimento?"
        confirmLabel="Sim, remover banimento"
        busy={busy}
        error={dialogError}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      >
        {confirming !== null && (
          <p>
            {confirming.name} deixará de estar em shadow ban e os eventos que publicar voltarão a aparecer no mural.
            Eventos ocultados continuam ocultos até serem reexibidos na fila de denúncias.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
