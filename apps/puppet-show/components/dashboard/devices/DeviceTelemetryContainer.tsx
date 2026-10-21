/**
 * Device page container (Admin+): loads the device, its status, telemetry,
 * commands and logs, refreshes them every 10 seconds and sends commands.
 *
 * A failed refresh keeps the last data on screen and shows the error with the
 * time of the data; the first load failing shows the error with a retry.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { MdRefresh } from "react-icons/md";
import { api, ApiErrorMessage, type ApiError } from "@/lib/api/client";
import type { Command, CommandType, CreateCommandInput, WakeupOutcome } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { CommandIssuedNotice } from "./CommandIssuedNotice";
import { WakeupResentNotice } from "./WakeupResentNotice";
import { COMMAND_LABELS, DeviceTelemetry, type DeviceDetails } from "./DeviceTelemetry";
import { SendUpdateFile, UpdateStepText } from "./updateUpload";

/** How often the page reloads the device. */
const REFRESH_INTERVAL_MS = 10_000;

/** Data on screen and when it was loaded. */
type Loaded = { details: DeviceDetails; loadedAt: string };

/** What the last command attempt left to tell the person: a failure, the stored Command with its Wake-up outcome, or the outcome of a resent Wake-up. */
type Feedback =
  | { kind: "error"; text: string }
  | { kind: "issued"; commandLabel: string; wakeup: WakeupOutcome }
  | { kind: "resent"; commandLabel: string; wakeup: WakeupOutcome };

/** Text for a failed load; 404 means the device isn't in this organization. */
function LoadErrorText(what: string, error: ApiError): string {
  if (error.kind === "http" && error.status === 404) return "Dispositivo não encontrado nesta organização.";
  return `Não foi possível carregar ${what}. ${ApiErrorMessage(error)}`;
}

/** Loads everything about a device. */
async function LoadDetails(orgId: string, deviceId: string): Promise<Result<DeviceDetails, string>> {
  const [device, status, telemetry, commands, logs] = await Promise.all([
    api.devices.get(orgId, deviceId),
    api.devices.status(orgId, deviceId),
    api.devices.telemetry(orgId, deviceId),
    api.devices.commands(orgId, deviceId),
    api.devices.logs(orgId, deviceId),
  ]);
  if (!device.ok) return Err(LoadErrorText("o dispositivo", device.error));
  if (!status.ok) return Err(LoadErrorText("o status do dispositivo", status.error));
  if (!telemetry.ok) return Err(LoadErrorText("a telemetria", telemetry.error));
  if (!commands.ok) return Err(LoadErrorText("os comandos", commands.error));
  if (!logs.ok) return Err(LoadErrorText("os logs", logs.error));

  return Ok({
    device: device.value,
    status: status.value,
    telemetry: telemetry.value.telemetry,
    commands: [...commands.value].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    logs: [...logs.value].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  });
}

/** The page, guarded by the section rules. */
export function DeviceTelemetryContainer({ deviceId }: { deviceId: string }) {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("devices", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <DevicePage key={`${orgId}/${deviceId}`} orgId={orgId} deviceId={deviceId} />;
}

/** One device of one organization. */
function DevicePage({ orgId, deviceId }: { orgId: string; deviceId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [sending, setSending] = useState<CommandType | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [updateProgress, setUpdateProgress] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = () => {
      LoadDetails(orgId, deviceId).then((result) => {
        if (!active) return;
        if (result.ok) {
          setLoaded({ details: result.value, loadedAt: new Date().toISOString() });
          setLoadError("");
        } else {
          setLoadError(result.error);
        }
      });
    };
    run();
    const timer = setInterval(run, REFRESH_INTERVAL_MS);
    return () => { active = false; clearInterval(timer); };
  }, [orgId, deviceId, reloadKey]);

  const handleCommand = async (command: CreateCommandInput): Promise<string | null> => {
    setSending(command.type);
    setFeedback(null);
    const sent = await api.devices.sendCommand(orgId, deviceId, command);
    setSending(null);

    if (!sent.ok) {
      const text = `Não foi possível enviar “${COMMAND_LABELS[command.type]}”. ${ApiErrorMessage(sent.error)}`;
      setFeedback({ kind: "error", text });
      return text;
    }
    setFeedback({ kind: "issued", commandLabel: COMMAND_LABELS[command.type], wakeup: sent.value.wakeup });
    setReloadKey((key) => key + 1);
    return null;
  };

  const handleResendWakeup = async (command: Command): Promise<string | null> => {
    const label = COMMAND_LABELS[command.type];
    setResending(command.id);
    setFeedback(null);
    const resent = await api.devices.resendWakeup(orgId, deviceId, command.id);
    setResending(null);

    if (!resent.ok) {
      setReloadKey((key) => key + 1);
      return `Não foi possível reenviar o aviso do comando “${label}”. ${ApiErrorMessage(resent.error)}`;
    }
    setFeedback({ kind: "resent", commandLabel: label, wakeup: resent.value });
    return null;
  };

  const handleUpdateFile = async (file: File, version: string | undefined): Promise<string | null> => {
    setSending("update");
    setFeedback(null);
    const sent = await SendUpdateFile(orgId, deviceId, file, version, (step) => setUpdateProgress(UpdateStepText(step)));
    setSending(null);
    setUpdateProgress("");

    if (!sent.ok) {
      const text = `Não foi possível enviar “${COMMAND_LABELS.update}”. ${sent.error}`;
      setFeedback({ kind: "error", text });
      return text;
    }
    setFeedback({ kind: "issued", commandLabel: COMMAND_LABELS.update, wakeup: sent.value.wakeup });
    setReloadKey((key) => key + 1);
    return null;
  };

  if (loaded === null) {
    if (loadError === "") return <LoadingMessage>Carregando dispositivo...</LoadingMessage>;
    return (
      <div className="column items-start gap-3">
        <ErrorAlert>{loadError}</ErrorAlert>
        <button type="button" onClick={() => { setLoadError(""); setReloadKey((key) => key + 1); }} className="button focus-ring">
          <MdRefresh aria-hidden className="h-[18px] w-[18px]" /> Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="column gap-[22px]">
      {feedback?.kind === "issued" && <CommandIssuedNotice commandLabel={feedback.commandLabel} wakeup={feedback.wakeup} />}
      {feedback?.kind === "resent" && <WakeupResentNotice commandLabel={feedback.commandLabel} wakeup={feedback.wakeup} />}
      {feedback?.kind === "error" && <ErrorAlert>{feedback.text}</ErrorAlert>}
      <DeviceTelemetry
        details={loaded.details}
        loadedAt={loaded.loadedAt}
        refreshError={loadError === "" ? "" : `Falha ao atualizar; os dados abaixo são os últimos recebidos. ${loadError}`}
        sending={sending}
        onCommand={handleCommand}
        onUpdateFile={handleUpdateFile}
        updateProgress={updateProgress}
        onRefresh={() => setReloadKey((key) => key + 1)}
        onResendWakeup={handleResendWakeup}
        resendingCommandId={resending}
      />
    </div>
  );
}
