/**
 * Orphan devices page (Superadmin, global context): assigns a device that
 * connected without an organization to one (approving it with a name and
 * location) or rejects it after confirmation.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { Device, Organization } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, useDashboard } from "../../DashboardContext";
import { AccessNotice } from "../AccessNotice";
import { ApproveDeviceForm, type ApprovalSubmission } from "../../devices/ApproveDeviceForm";
import { DeviceIdentifierText } from "../../devices/telemetryFormat";
import { OrphanDeviceList } from "./OrphanDeviceList";

/** What the page needs. */
type OrphanData = { devices: Device[]; organizations: Organization[] };

/** Loads the orphan devices and the organizations to assign them to. */
async function LoadOrphans(): Promise<Result<OrphanData, string>> {
  const [devices, organizations] = await Promise.all([api.devices.listPending(), api.organizations.list()]);
  if (!devices.ok) return Err(`Não foi possível carregar os dispositivos órfãos. ${ApiErrorMessage(devices.error)}`);
  if (!organizations.ok) return Err(`Não foi possível carregar as organizações. ${ApiErrorMessage(organizations.error)}`);
  return Ok({ devices: devices.value, organizations: organizations.value });
}

/** The page, guarded by the section rules. */
export function GlobalDevicesContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("global-devices", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  return <Orphans />;
}

/** The orphan queue. */
function Orphans() {
  const [data, setData] = useState<Result<OrphanData, string> | null>(null);
  const [assigning, setAssigning] = useState<Device | null>(null);
  const [rejecting, setRejecting] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    LoadOrphans().then((result) => { if (active) setData(result); });
    return () => { active = false; };
  }, []);

  /** Drops a handled device from the queue. */
  const drop = (id: string) => setData((current) => current !== null && current.ok
    ? Ok({ ...current.value, devices: current.value.devices.filter((d) => d.id !== id) })
    : current);

  const open = (setter: (device: Device) => void) => (device: Device) => { setActionError(""); setStatus(""); setter(device); };

  const handleAssign = async (approval: ApprovalSubmission) => {
    if (assigning === null) return;
    setBusy(true);
    setActionError("");
    const result = await api.devices.approve(assigning.id, approval);
    setBusy(false);
    if (!result.ok) { setActionError(`Não foi possível atribuir o dispositivo. ${ApiErrorMessage(result.error)}`); return; }
    drop(assigning.id);
    setStatus(`Dispositivo “${approval.name}” atribuído e aprovado.`);
    setAssigning(null);
  };

  const handleReject = async () => {
    if (rejecting === null) return;
    setBusy(true);
    setActionError("");
    const result = await api.devices.reject(rejecting.id);
    setBusy(false);
    if (!result.ok) { setActionError(`Não foi possível rejeitar o dispositivo. ${ApiErrorMessage(result.error)}`); return; }
    drop(rejecting.id);
    setStatus(`Dispositivo ${DeviceIdentifierText(rejecting)} rejeitado.`);
    setRejecting(null);
  };

  if (data === null) return <LoadingMessage>Carregando dispositivos órfãos...</LoadingMessage>;
  if (!data.ok) return <ErrorAlert>{data.error}</ErrorAlert>;

  const busyDeviceId = busy ? (assigning !== null ? assigning.id : rejecting !== null ? rejecting.id : null) : null;

  return (
    <div className="column gap-4">
      <StatusMessage>{status}</StatusMessage>
      <OrphanDeviceList devices={data.value.devices} busyDeviceId={busyDeviceId} onAssign={open(setAssigning)} onReject={open(setRejecting)} />

      <Drawer isOpen={assigning !== null} onClose={() => { if (!busy) setAssigning(null); }} title="Atribuir dispositivo">
        {assigning !== null && (
          <ApproveDeviceForm
            key={assigning.id}
            identifier={DeviceIdentifierText(assigning)}
            organizations={[...data.value.organizations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))}
            saving={busy}
            error={actionError}
            onSubmit={handleAssign}
            onCancel={() => setAssigning(null)}
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
            O dispositivo <span className="font-mono break-all">{DeviceIdentifierText(rejecting)}</span> sai desta fila e não poderá
            exibir o mural. Para usá-lo depois, ele precisa se conectar de novo.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
