/**
 * Everything about one device: its name with the online badge, place, last
 * heartbeat and identifier; the hardware numbers as big tiles; remote
 * commands (destructive ones confirmed; "update" through a validated form in
 * a side panel); every other telemetry field in readable groups; the command
 * history and the logs.
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
import {
  DeviceDisplayName, DeviceIdentifierText, FormatBytes, NOT_REPORTED, TelemetryGroups, type TelemetryGroup,
} from "./telemetryFormat";
import { UpdateCommandForm } from "./UpdateCommandForm";
import type { UpdateRequest } from "./deviceForms";

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
  /** Uploads a Puppet binary and sends the update command for it; resolves like `onCommand`. */
  onUpdateFile: (file: File, version: string | undefined) => Promise<string | null>;
  /** What the upload is doing right now; empty when it is not running. */
  updateProgress: string;
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

/** Label shown before a value when the table is stacked, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="cell-label">{children}</span>;
}

/** Badge colour of each command status. */
const COMMAND_STATUS_TONES: Record<CommandStatus, string> = {
  pending: "b-neutral",
  sent: "b-info",
  acknowledged: "b-info",
  completed: "b-ok",
  failed: "b-bad",
};

/** Values that read as good news (green) or as a problem (amber) in the telemetry cards. */
const GOOD_VALUES = new Set(["Conectado", "Ligada", "Ativado", "Configurado"]);
const BAD_VALUES = new Set(["Desconectado", "Desligada", "Desativado", "Não configurado"]);

/** Colour class of a telemetry value. */
function ValueTone(value: string): string {
  if (value === NOT_REPORTED) return "t3";
  if (GOOD_VALUES.has(value)) return "c-ok";
  if (BAD_VALUES.has(value)) return "c-warn";
  return "";
}

/** One big-number tile of the hardware row. */
type HardwareTile = {
  label: string;
  value: string;
  /** Smaller line under the value. */
  note?: string;
  /** Temperature scale (green to red, with a marker) or a filled bar, in percent. */
  meter?: { kind: "scale" | "fill"; percent: number };
};

/** Keeps a percentage between 0 and 100. */
function Clamp(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

/**
 * The "Hardware" group as tiles: temperature on a scale, memory with Puppet's
 * share, disk as a share with the full text under it, and uptime with when
 * the device was turned on (from the time the data was loaded).
 */
function HardwareTiles(t: Telemetry, items: TelemetryGroup["items"], loadedAt: string): HardwareTile[] {
  const valueOf = (label: string) => items.find((item) => item.label === label)?.value ?? NOT_REPORTED;
  const disk = valueOf("Disco em uso");
  const diskShare = t.diskUsage !== undefined && t.diskTotal !== undefined && t.diskTotal > 0 ? (t.diskUsage / t.diskTotal) * 100 : null;
  const loadedMs = Date.parse(loadedAt);
  const since = t.uptime !== undefined && !Number.isNaN(loadedMs) ? new Date(loadedMs - t.uptime * 1000).toISOString() : null;

  return [
    {
      label: "Temperatura da CPU",
      value: valueOf("Temperatura da CPU"),
      ...(t.cpuTemp !== undefined ? { meter: { kind: "scale" as const, percent: Clamp(t.cpuTemp) } } : {}),
    },
    {
      label: "Memória em uso",
      value: valueOf("Memória em uso"),
      ...(t.puppetMemoryUsage !== undefined ? { note: `Puppet: ${FormatBytes(t.puppetMemoryUsage)}` } : {}),
    },
    diskShare === null
      ? { label: "Disco em uso", value: disk }
      : { label: "Disco em uso", value: `${Math.round(diskShare)}%`, note: disk, meter: { kind: "fill" as const, percent: Clamp(diskShare) } },
    {
      label: "Ligado há",
      value: valueOf("Ligado há"),
      ...(since !== null ? { note: `desde ${FormatInstant(since)}` } : {}),
    },
  ];
}

/** The device page. */
export function DeviceTelemetry({ details, loadedAt, refreshError, sending, onCommand, onUpdateFile, updateProgress, onRefresh }: DeviceTelemetryProps) {
  const { device, status, telemetry, commands, logs } = details;
  const [confirming, setConfirming] = useState<ConfirmedCommand | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const busy = sending !== null;
  const heartbeatErrors = status.latestHeartbeat !== null && status.latestHeartbeat.errors !== undefined ? status.latestHeartbeat.errors : [];
  const groups = telemetry === null ? [] : TelemetryGroups(telemetry);
  const hardware = groups.find((group) => group.title === "Hardware");
  const otherGroups = groups.filter((group) => group !== hardware);

  const confirm = async () => {
    if (confirming === null) return;
    const type = confirming;
    setConfirming(null);
    await onCommand({ type });
  };

  const sendUpdate = async (request: UpdateRequest) => {
    setUpdateError("");
    const error = request.kind === "url"
      ? await onCommand({ type: "update", payload: request.payload })
      : await onUpdateFile(request.file, request.version);
    if (error === null) setUpdateOpen(false);
    else setUpdateError(error);
  };

  const confirmation = confirming === null ? null : CONFIRMATIONS[confirming];

  return (
    <div className="column gap-[22px]">
      <section aria-labelledby="device-title" className="column gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="column min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="device-title" className="h1 break-words">{DeviceDisplayName(device)}</h2>
              <OnlineBadge status={status} className="text-[13px]" />
            </div>
            <p className="t2 flex flex-wrap gap-x-[18px] gap-y-1">
              <span className={`break-words ${device.location === undefined ? "t3" : ""}`}>{device.location === undefined ? "Local não informado" : device.location}</span>
              <span>{LastHeartbeatText(status)}</span>
              <span className="mono break-all text-[13px]">{DeviceIdentifierText(device)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 max-sm:w-full max-sm:justify-between">
            <p className="t3 text-[13px]">Dados de {FormatInstant(loadedAt)}; atualiza a cada 10 s.</p>
            <button type="button" onClick={onRefresh} className="button focus-ring">
              <MdRefresh aria-hidden className="h-[18px] w-[18px]" /> Atualizar agora
            </button>
          </div>
        </div>

        <ErrorAlert>{refreshError}</ErrorAlert>

        {heartbeatErrors.length > 0 && (
          <div role="alert" className="notice n-bad column">
            <p className="font-semibold">Erros relatados pelo dispositivo:</p>
            <ul className="ml-5 list-disc">{heartbeatErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          </div>
        )}
      </section>

      {telemetry !== null && hardware !== undefined && (
        <section aria-label={hardware.title} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
          {HardwareTiles(telemetry, hardware.items, loadedAt).map((tile) => (
            <div key={tile.label} className="glass column gap-2.5 rounded-[22px] p-[18px]">
              <span className="t3 text-[13px]">{tile.label}</span>
              <span className={`font-display font-semibold leading-none tracking-[-.03em] break-words ${tile.value === NOT_REPORTED ? "t3 text-xl" : "text-[34px]"}`}>{tile.value}</span>
              {tile.meter !== undefined && tile.meter.kind === "scale" && (
                <span aria-hidden className="relative h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--ok), var(--warn) 60%, var(--bad))" }}>
                  <span
                    className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-sm bg-foreground"
                    style={{ left: `${tile.meter.percent}%`, boxShadow: "0 0 0 2px var(--bg)" }}
                  />
                </span>
              )}
              {tile.meter !== undefined && tile.meter.kind === "fill" && (
                <span aria-hidden className="surface-2 h-1.5 overflow-hidden rounded-full">
                  <span className="block h-full bg-[var(--accent-ink)]" style={{ width: `${tile.meter.percent}%` }} />
                </span>
              )}
              {tile.note !== undefined && <span className="t3 text-[12.5px] break-words">{tile.note}</span>}
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="device-commands-title" className="glass column gap-4 rounded-[26px] p-5">
        <h2 id="device-commands-title" className="h2">Comandos</h2>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
          <button type="button" disabled={busy} onClick={() => onCommand({ type: "request_telemetry" })} className="button focus-ring">
            <MdSensors aria-hidden className="h-[18px] w-[18px]" /> {sending === "request_telemetry" ? "Enviando..." : "Pedir telemetria"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming("open_ssh")} className="button focus-ring">
            <MdTerminal aria-hidden className="h-[18px] w-[18px]" /> {sending === "open_ssh" ? "Enviando..." : "Abrir SSH"}
          </button>
          <button type="button" disabled={busy} onClick={() => { setUpdateError(""); setUpdateOpen(true); }} className="button focus-ring">
            <MdSystemUpdateAlt aria-hidden className="h-[18px] w-[18px]" /> Atualizar Puppet
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming("restart")} className="button warn-soft focus-ring">
            <MdRestartAlt aria-hidden className="h-[18px] w-[18px]" /> {sending === "restart" ? "Enviando..." : "Reiniciar"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming("shutdown")} className="button danger-soft focus-ring">
            <MdPowerSettingsNew aria-hidden className="h-[18px] w-[18px]" /> {sending === "shutdown" ? "Enviando..." : "Desligar"}
          </button>
        </div>
      </section>

      <section aria-labelledby="telemetry-title" className="column gap-3">
        <h2 id="telemetry-title" className="h2">Telemetria</h2>
        {telemetry === null ? (
          <p className="glass t2 rounded-[22px] border-dashed p-6 text-center text-sm">
            O dispositivo ainda não enviou telemetria. Use “Pedir telemetria” para solicitar.
          </p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
            {otherGroups.map((group) => (
              <section key={group.title} aria-label={group.title} className="glass column gap-2 rounded-[22px] px-[18px] py-4">
                <h3 className="caption">{group.title}</h3>
                <dl className="column text-sm">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4 border-t border-[color:var(--line)] py-[7px]">
                      <dt className="t2">{item.label}</dt>
                      <dd className={`text-right font-medium break-all ${ValueTone(item.value)}`}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {group.lists.map((list) => (
                  <div key={list.label} className="column gap-1 border-t border-[color:var(--line)] py-[7px] text-sm">
                    <h4 className="t2">{list.label}</h4>
                    {list.entries === null ? (
                      <p className="t3 font-medium">{NOT_REPORTED}</p>
                    ) : list.entries.length === 0 ? (
                      <p className="t3 font-medium">Nenhum registro</p>
                    ) : (
                      <ul className="mono max-h-40 overflow-y-auto text-[12.5px]">
                        {list.entries.map((entry, index) => <li key={index} className="break-all">{entry}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="commands-title" className="glass overflow-hidden rounded-[26px]">
        <h2 id="commands-title" className="h2 border-b border-[color:var(--line)] px-5 py-[18px]">Histórico de comandos</h2>
        {commands.length === 0 ? (
          <p className="t2 px-5 py-6 text-sm">Nenhum comando enviado.</p>
        ) : (
          <table className="rtable text-sm">
            <caption className="sr-only">Comandos enviados ao dispositivo, do mais recente para o mais antigo</caption>
            <thead>
              <tr>
                <th scope="col" className="pl-5">Comando</th>
                <th scope="col">Status</th>
                <th scope="col">Enviado em</th>
                <th scope="col">Concluído em</th>
                <th scope="col" className="pr-5">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((command) => (
                <tr key={command.id}>
                  <th scope="row" className="pl-5 font-semibold">{COMMAND_LABELS[command.type]}</th>
                  <td><span className={`badge ${COMMAND_STATUS_TONES[command.status]}`}>{COMMAND_STATUS_LABELS[command.status]}</span></td>
                  <td className="mono text-[13px]"><CellLabel>Enviado em</CellLabel>{FormatInstant(command.issuedAt)}</td>
                  <td className="mono t2 text-[13px]">
                    <CellLabel>Concluído em</CellLabel>{command.completedAt === undefined ? "Ainda não" : FormatInstant(command.completedAt)}
                  </td>
                  <td className="t2 pr-5 break-all">{PayloadText(command)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="logs-title" className="glass column gap-3 rounded-[26px] px-5 pb-5 pt-[18px]">
        <h2 id="logs-title" className="h2">Logs</h2>
        {logs.length === 0 ? (
          <p className="t2 text-sm">Nenhum log recebido.</p>
        ) : (
          <ul
            tabIndex={0}
            aria-labelledby="logs-title"
            className="well mono focus-ring column max-h-[220px] overflow-y-auto rounded-2xl border border-[color:var(--line)] p-4 text-[12.5px] leading-[1.7]"
          >
            {logs.map((log) => (
              <li key={log.id} className="break-words">
                <span className="t3">{FormatInstant(log.timestamp)}</span>{" "}
                <span className={`uppercase ${log.level === "error" ? "c-bad" : log.level === "warn" ? "c-warn" : "c-ok"}`}>{log.level}</span>{" "}
                <span>{log.message}</span>
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
            progress={updateProgress}
            onSubmit={sendUpdate}
            onCancel={() => setUpdateOpen(false)}
          />
        )}
      </Drawer>
    </div>
  );
}
