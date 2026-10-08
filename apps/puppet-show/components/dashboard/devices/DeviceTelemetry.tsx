/**
 * Everything about one device: status and last heartbeat, remote commands
 * (destructive ones confirmed; "update" through a validated form), every
 * telemetry field in readable groups, the command history and the logs.
 *
 * The container refreshes the data periodically; when a refresh fails the
 * last data stays on screen with the error above it.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdPowerSettingsNew, MdRefresh, MdRestartAlt, MdSensors, MdSystemUpdateAlt, MdTerminal } from "react-icons/md";
import type { Command, CommandStatus, CommandType, CreateCommandInput, Device, DeviceLog, DeviceStatus, DeviceTelemetry as Telemetry } from "@/lib/api/schemas";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorAlert } from "@/components/ui/Feedback";
import { FormatInstant } from "../audit/instant";
import { LastHeartbeatText, OnlineBadge } from "./DeviceList";
import { DeviceDisplayName, DeviceIdentifierText, TelemetryGroups } from "./telemetryFormat";
import { UpdateCommandForm } from "./UpdateCommandForm";
import type { UpdatePayload } from "./deviceForms";

/** Everything the page shows about a device. */
export type DeviceDetails = {
  device: Device;
  status: DeviceStatus;
  /** `null` until the device sends telemetry for the first time. */
  telemetry: Telemetry | null;
  commands: Command[];
  logs: DeviceLog[];
};

export type DeviceTelemetryProps = {
  details: DeviceDetails;
  /** When the data on screen was loaded. */
  loadedAt: string;
  /** Why the latest refresh failed (the data shown is from `loadedAt`). */
  refreshError: string;
  /** Command being sent right now; the command buttons are disabled meanwhile. */
  sending: CommandType | null;
  /** Sends a command; resolves to an error message, or `null` when it worked. */
  onCommand: (command: CreateCommandInput) => Promise<string | null>;
  onRefresh: () => void;
};

/** Portuguese label of each command. */
export const COMMAND_LABELS: Record<CommandType, string> = {
  restart: "Reiniciar",
  shutdown: "Desligar",
  update: "Atualizar Puppet",
  open_ssh: "Abrir SSH",
  custom: "Personalizado",
  request_telemetry: "Pedir telemetria",
};

/** Portuguese label of each command status. */
export const COMMAND_STATUS_LABELS: Record<CommandStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  acknowledged: "Recebido",
  completed: "Concluído",
  failed: "Falhou",
};

/** Commands that ask for confirmation, with what to say. */
const CONFIRMATIONS = {
  restart: { title: "Reiniciar o dispositivo?", body: "O mural fica fora do ar enquanto o dispositivo reinicia.", confirm: "Sim, reiniciar", danger: true },
  shutdown: { title: "Desligar o dispositivo?", body: "O mural sai do ar e o dispositivo só volta quando alguém o ligar no local.", confirm: "Sim, desligar", danger: true },
  open_ssh: { title: "Abrir acesso SSH?", body: "O dispositivo abre um acesso remoto por SSH para manutenção.", confirm: "Sim, abrir SSH", danger: false },
} as const;

type ConfirmedCommand = keyof typeof CONFIRMATIONS;

/** Short description of a command's payload. */
function PayloadText(command: Command): string {
  if (command.type !== "update" || command.payload === undefined) return "Sem detalhes";
  const { version, url } = command.payload;
  const parts = [typeof version === "string" ? `Versão ${version}` : "", typeof url === "string" ? url : ""];
  return parts.filter((part) => part !== "").join(" · ");
}

/** Label shown before a value on phones, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="block text-xs text-foreground/70 md:hidden">{children}</span>;
}

/** The device page. */
export function DeviceTelemetry({ details, loadedAt, refreshError, sending, onCommand, onRefresh }: DeviceTelemetryProps) {
  const { device, status, telemetry, commands, logs } = details;
  const [confirming, setConfirming] = useState<ConfirmedCommand | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const busy = sending !== null;
  const heartbeatErrors = status.latestHeartbeat !== null && status.latestHeartbeat.errors !== undefined ? status.latestHeartbeat.errors : [];

  const confirm = async () => {
    if (confirming === null) return;
    const type = confirming;
    setConfirming(null);
    await onCommand({ type });
  };

  const sendUpdate = async (payload: UpdatePayload) => {
    setUpdateError("");
    const error = await onCommand({ type: "update", payload });
    if (error === null) setUpdateOpen(false);
    else setUpdateError(error);
  };

  const confirmation = confirming === null ? null : CONFIRMATIONS[confirming];

  return (
    <div className="column gap-6">
      <section aria-labelledby="device-title" className="card column gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 column gap-1">
            <div className="row flex-wrap gap-3">
              <h2 id="device-title" className="subtitle break-words">{DeviceDisplayName(device)}</h2>
              <OnlineBadge status={status} />
            </div>
            <p className="text-sm text-foreground/70 break-words">{device.location === undefined ? "Local não informado" : device.location}</p>
            <p className="text-sm text-foreground/70">Identificador: <span className="font-mono break-all">{DeviceIdentifierText(device)}</span></p>
            <p className="text-sm text-foreground/70">{LastHeartbeatText(status)}</p>
          </div>
          <div className="column items-end gap-1">
            <button type="button" onClick={onRefresh} className="button clean min-h-10">
              <MdRefresh aria-hidden className="icon" /> Atualizar agora
            </button>
            <p className="text-xs text-foreground/70">Dados de {FormatInstant(loadedAt)}; atualiza a cada 10 s.</p>
          </div>
        </div>

        <ErrorAlert>{refreshError}</ErrorAlert>

        {heartbeatErrors.length > 0 && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">Erros relatados pelo dispositivo:</p>
            <ul className="ml-5 list-disc">{heartbeatErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          </div>
        )}

        <div className="column gap-2">
          <h3 className="font-medium">Comandos</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <button type="button" disabled={busy} onClick={() => onCommand({ type: "request_telemetry" })} className="button clean min-h-10">
              <MdSensors aria-hidden className="icon" /> {sending === "request_telemetry" ? "Enviando..." : "Pedir telemetria"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming("open_ssh")} className="button clean min-h-10">
              <MdTerminal aria-hidden className="icon" /> {sending === "open_ssh" ? "Enviando..." : "Abrir SSH"}
            </button>
            <button type="button" disabled={busy} onClick={() => { setUpdateError(""); setUpdateOpen(true); }} className="button clean min-h-10">
              <MdSystemUpdateAlt aria-hidden className="icon" /> Atualizar Puppet
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming("restart")} className="button clean min-h-10 text-main">
              <MdRestartAlt aria-hidden className="icon" /> {sending === "restart" ? "Enviando..." : "Reiniciar"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming("shutdown")} className="button clean min-h-10 text-danger">
              <MdPowerSettingsNew aria-hidden className="icon" /> {sending === "shutdown" ? "Enviando..." : "Desligar"}
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="telemetry-title" className="column gap-3">
        <h2 id="telemetry-title" className="subtitle">Telemetria</h2>
        {telemetry === null ? (
          <p className="rounded-lg border border-dashed border-muted p-6 text-center text-sm text-foreground/70">
            O dispositivo ainda não enviou telemetria. Use “Pedir telemetria” para solicitar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TelemetryGroups(telemetry).map((group) => (
              <section key={group.title} aria-label={group.title} className="card column gap-2">
                <h3 className="font-medium">{group.title}</h3>
                <dl className="column divide-y divide-muted text-sm">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-foreground/70">{item.label}</dt>
                      <dd className="text-right break-all">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {group.lists.map((list) => (
                  <div key={list.label} className="text-sm">
                    <h4 className="text-foreground/70">{list.label}</h4>
                    {list.entries === null ? (
                      <p>Não informado</p>
                    ) : list.entries.length === 0 ? (
                      <p>Nenhum registro</p>
                    ) : (
                      <ul className="max-h-40 overflow-y-auto">{list.entries.map((entry, index) => <li key={index} className="break-all">{entry}</li>)}</ul>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="commands-title" className="column gap-3">
        <h2 id="commands-title" className="subtitle">Histórico de comandos</h2>
        {commands.length === 0 ? (
          <p className="text-sm text-foreground/70">Nenhum comando enviado.</p>
        ) : (
          <table className="block w-full text-sm md:table">
            <caption className="sr-only">Comandos enviados ao dispositivo, do mais recente para o mais antigo</caption>
            <thead className="sr-only md:not-sr-only md:table-header-group">
              <tr className="border-b border-muted text-left">
                <th scope="col" className="p-3 font-semibold">Comando</th>
                <th scope="col" className="p-3 font-semibold">Status</th>
                <th scope="col" className="p-3 font-semibold">Enviado em</th>
                <th scope="col" className="p-3 font-semibold">Concluído em</th>
                <th scope="col" className="p-3 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody className="column gap-3 md:table-row-group">
              {commands.map((command) => (
                <tr key={command.id} className="card block md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent">
                  <th scope="row" className="block py-1 text-left font-medium md:table-cell md:p-3">{COMMAND_LABELS[command.type]}</th>
                  <td className={`block py-1 md:table-cell md:p-3 ${command.status === "failed" ? "text-danger" : command.status === "completed" ? "text-success" : ""}`}>
                    <CellLabel>Status</CellLabel>{COMMAND_STATUS_LABELS[command.status]}
                  </td>
                  <td className="block py-1 md:table-cell md:p-3"><CellLabel>Enviado em</CellLabel>{FormatInstant(command.issuedAt)}</td>
                  <td className="block py-1 md:table-cell md:p-3">
                    <CellLabel>Concluído em</CellLabel>{command.completedAt === undefined ? "Ainda não" : FormatInstant(command.completedAt)}
                  </td>
                  <td className="block py-1 break-all md:table-cell md:p-3"><CellLabel>Detalhes</CellLabel>{PayloadText(command)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="logs-title" className="column gap-3">
        <h2 id="logs-title" className="subtitle">Logs</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-foreground/70">Nenhum log recebido.</p>
        ) : (
          <ul tabIndex={0} aria-labelledby="logs-title" className="column max-h-80 gap-1 overflow-y-auto rounded-lg border border-muted bg-surface p-3 font-mono text-xs">
            {logs.map((log) => (
              <li key={log.id} className="break-words">
                <span className="text-foreground/70">{FormatInstant(log.timestamp)}</span>{" "}
                <span className={log.level === "error" ? "text-danger" : log.level === "warn" ? "text-main" : "text-success"}>[{log.level}]</span>{" "}
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmation !== null}
        title={confirmation === null ? "" : confirmation.title}
        confirmLabel={confirmation === null ? "" : confirmation.confirm}
        danger={confirmation !== null && confirmation.danger}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
      >
        {confirmation !== null && <p>{confirmation.body}</p>}
      </ConfirmDialog>

      <Drawer isOpen={updateOpen} onClose={() => { if (sending !== "update") setUpdateOpen(false); }} title="Atualizar o Puppet">
        {updateOpen && (
          <UpdateCommandForm
            saving={sending === "update"}
            error={updateError}
            onSubmit={sendUpdate}
            onCancel={() => setUpdateOpen(false)}
          />
        )}
      </Drawer>
    </div>
  );
}
