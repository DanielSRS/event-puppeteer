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
import { api, ApiErrorMessage, type ApiError } from "@/lib/api/client";
import type { CommandType, CreateCommandInput } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { COMMAND_LABELS, DeviceTelemetry, type DeviceDetails } from "./DeviceTelemetry";

/** How often the page reloads the device. */
const REFRESH_INTERVAL_MS = 10_000;

/** Data on screen and when it was loaded. */
type Loaded = { details: DeviceDetails; loadedAt: string };

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
    telemetry: telemetry.value,
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
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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
      setFeedback({ ok: false, text });
      return text;
    }
    setFeedback({ ok: true, text: `Comando “${COMMAND_LABELS[command.type]}” enviado. O dispositivo o executa na próxima sincronização.` });
    setReloadKey((key) => key + 1);
    return null;
  };

  if (loaded === null) {
    if (loadError === "") return <LoadingMessage>Carregando dispositivo...</LoadingMessage>;
    return (
      <div className="column items-start gap-3">
        <ErrorAlert>{loadError}</ErrorAlert>
        <button type="button" onClick={() => { setLoadError(""); setReloadKey((key) => key + 1); }} className="button clean min-h-10">
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="column gap-4">
      {feedback !== null && (feedback.ok ? <StatusMessage>{feedback.text}</StatusMessage> : <ErrorAlert>{feedback.text}</ErrorAlert>)}
      <DeviceTelemetry
        details={loaded.details}
        loadedAt={loaded.loadedAt}
        refreshError={loadError === "" ? "" : `Falha ao atualizar; os dados abaixo são os últimos recebidos. ${loadError}`}
        sending={sending}
        onCommand={handleCommand}
        onRefresh={() => setReloadKey((key) => key + 1)}
      />
    </div>
  );
}
