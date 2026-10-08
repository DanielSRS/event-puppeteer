/**
 * Organization devices page (Admin+): approves pending devices through a form
 * (name and location), rejects them after confirmation, and lists the active
 * ones with their online status.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Device } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { ApproveDeviceForm, type ApprovalSubmission } from "./ApproveDeviceForm";
import { DeviceList, type ActiveDevice } from "./DeviceList";
import { DeviceIdentifierText } from "./telemetryFormat";

/** Both lists of the page. */
type DeviceLists = { pending: Device[]; active: ActiveDevice[] };

/** Loads the pending and active devices of `orgId`, with the status of each active one. */
async function LoadDevices(orgId: string): Promise<Result<DeviceLists, string>> {
  const [pending, active] = await Promise.all([api.devices.listOrgPending(orgId), api.devices.listActive(orgId)]);
  if (!pending.ok) return Err(`Não foi possível carregar os dispositivos pendentes. ${ApiErrorMessage(pending.error)}`);
  if (!active.ok) return Err(`Não foi possível carregar os dispositivos ativos. ${ApiErrorMessage(active.error)}`);

  const statuses = await Promise.all(active.value.map((device) => api.devices.status(orgId, device.id)));
  return Ok({
    pending: pending.value,
    active: active.value.map((device, index): ActiveDevice => {
      const status = statuses[index];
      return { device, status: status.ok ? Ok(status.value) : Err(`Status indisponível. ${ApiErrorMessage(status.error)}`) };
    }),
  });
}

/** The page, guarded by the section rules. */
export function DashboardDevicesContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("devices", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <Devices key={orgId} orgId={orgId} />;
}

/** The devices of one organization; remounted when the organization changes. */
function Devices({ orgId }: { orgId: string }) {
  const [lists, setLists] = useState<Result<DeviceLists, string> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [approving, setApproving] = useState<Device | null>(null);
  const [rejecting, setRejecting] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    LoadDevices(orgId).then((result) => { if (active) setLists(result); });
    return () => { active = false; };
  }, [orgId, reloadKey]);

  const startAction = () => { setBusy(true); setActionError(""); setStatus(""); };

  const handleApprove = async (approval: ApprovalSubmission) => {
    if (approving === null) return;
    startAction();
    const result = await api.devices.approve(approving.id, approval);
    setBusy(false);
    if (!result.ok) { setActionError(`Não foi possível aprovar o dispositivo. ${ApiErrorMessage(result.error)}`); return; }
    setStatus(`Dispositivo “${approval.name}” aprovado.`);
    setApproving(null);
    setReloadKey((key) => key + 1);
  };

  const handleReject = async () => {
    if (rejecting === null) return;
    startAction();
    const result = await api.devices.reject(rejecting.id);
    setBusy(false);
    if (!result.ok) { setActionError(`Não foi possível rejeitar o dispositivo. ${ApiErrorMessage(result.error)}`); return; }
    const gone = rejecting.id;
    setLists((current) => current !== null && current.ok
      ? Ok({ ...current.value, pending: current.value.pending.filter((device) => device.id !== gone) })
      : current);
    setStatus(`Dispositivo ${DeviceIdentifierText(rejecting)} rejeitado.`);
    setRejecting(null);
  };

  if (lists === null) return <LoadingMessage>Carregando dispositivos...</LoadingMessage>;
  if (!lists.ok) return <ErrorAlert>{lists.error}</ErrorAlert>;

  const busyDeviceId = busy ? (approving !== null ? approving.id : rejecting !== null ? rejecting.id : null) : null;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <DeviceList
        pending={lists.value.pending}
        active={lists.value.active}
        busyDeviceId={busyDeviceId}
        onApprove={(device) => { setActionError(""); setStatus(""); setApproving(device); }}
        onReject={(device) => { setActionError(""); setStatus(""); setRejecting(device); }}
      />

      <Drawer isOpen={approving !== null} onClose={() => { if (!busy) setApproving(null); }} title="Aprovar dispositivo">
        {approving !== null && (
          <ApproveDeviceForm
            key={approving.id}
            identifier={DeviceIdentifierText(approving)}
            saving={busy}
            error={actionError}
            onSubmit={handleApprove}
            onCancel={() => setApproving(null)}
          />
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={rejecting !== null}
        title="Rejeitar este dispositivo?"
        confirmLabel="Sim, rejeitar"
        danger
        busy={busy}
        error={actionError}
        onConfirm={handleReject}
        onCancel={() => setRejecting(null)}
      >
        {rejecting !== null && (
          <p>
            O dispositivo <span className="font-mono break-all">{DeviceIdentifierText(rejecting)}</span> não poderá exibir o mural
            e deixará de aparecer nesta lista. Para usá-lo depois, ele precisa se conectar de novo.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
