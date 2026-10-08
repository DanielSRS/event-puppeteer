/**
 * Turns a device's telemetry (as sent by Puppet) into readable groups of
 * label/value pairs, covering every field of `DeviceTelemetrySchema`.
 * A field the device didn't send reads "Não informado", so a missing value is
 * never mistaken for zero or "no".
 *
 * Units follow Puppet: memory and disk in bytes, uptime in seconds, CPU usage
 * in percent, temperature in °C.
 *
 * @module
 */

import type { Device, DeviceTelemetry } from "@/lib/api/schemas";
import { FormatInstant } from "../audit/instant";

/** Text for a value the device didn't send. */
export const NOT_REPORTED = "Não informado";

/** One label/value line. */
export type TelemetryItem = { label: string; value: string };

/** A list field (history of times or connections). */
export type TelemetryList = { label: string; entries: string[] | null };

/** A titled group of lines and lists. */
export type TelemetryGroup = { title: string; items: TelemetryItem[]; lists: TelemetryList[] };

/** `536870912` → `"512,0 MB"`. */
export function FormatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: unit === 0 ? 0 : 1, maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

/** `93784` → `"1 d 2 h 3 min"`; under a minute → `"45 s"`. */
export function FormatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole < 60) return `${whole} s`;
  const days = Math.floor(whole / 86400);
  const hours = Math.floor((whole % 86400) / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const parts = [days > 0 ? `${days} d` : "", hours > 0 ? `${hours} h` : "", minutes > 0 ? `${minutes} min` : ""];
  return parts.filter((part) => part !== "").join(" ");
}

/** `51.5` → `"51,5 °C"`. */
export function FormatTemperature(celsius: number): string {
  return `${celsius.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
}

/** `12.345` → `"12,3%"`. */
export function FormatPercent(percent: number): string {
  return `${percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Formats a present value, or says it wasn't reported. */
function Show<T>(value: T | undefined, format: (value: T) => string): string {
  return value === undefined ? NOT_REPORTED : format(value);
}

/** Text as is. */
const Text = (value: string) => value;

/** Integer counters. */
const Count = (value: number) => value.toLocaleString("pt-BR");

/** `true`/`false` as two Portuguese words. */
function YesNo(yes: string, no: string): (value: boolean) => string {
  return (value) => value ? yes : no;
}

/** Disk usage with the total and the share used when both are known. */
function DiskText(t: DeviceTelemetry): string {
  if (t.diskUsage === undefined) return t.diskTotal === undefined ? NOT_REPORTED : `${NOT_REPORTED} de ${FormatBytes(t.diskTotal)}`;
  if (t.diskTotal === undefined || t.diskTotal === 0) return FormatBytes(t.diskUsage);
  return `${FormatBytes(t.diskUsage)} de ${FormatBytes(t.diskTotal)} (${FormatPercent((t.diskUsage / t.diskTotal) * 100)})`;
}

/** A list of instants or free text, formatted when it is a valid instant. */
function Entries(values: string[] | undefined): string[] | null {
  return values === undefined ? null : values.map(FormatInstant);
}

/** Every telemetry field, grouped for reading. */
export function TelemetryGroups(t: DeviceTelemetry): TelemetryGroup[] {
  return [
    {
      title: "Hardware",
      items: [
        { label: "Temperatura da CPU", value: Show(t.cpuTemp, FormatTemperature) },
        { label: "Memória em uso", value: Show(t.memoryUsage, FormatBytes) },
        { label: "Disco em uso", value: DiskText(t) },
        { label: "Ligado há", value: Show(t.uptime, FormatDuration) },
      ],
      lists: [],
    },
    {
      title: "Sistema",
      items: [
        { label: "Sistema operacional", value: Show(t.osVersion, Text) },
        { label: "Kernel", value: Show(t.kernelVersion, Text) },
        { label: "Usuários do sistema", value: Show(t.osUsers, Text) },
        { label: "Permissões do usuário", value: Show(t.userPermissions, Text) },
      ],
      lists: [],
    },
    {
      title: "Puppet",
      items: [
        { label: "Versão", value: Show(t.puppetVersion, Text) },
        { label: "Uso de CPU", value: Show(t.puppetCpuUsage, FormatPercent) },
        { label: "Memória", value: Show(t.puppetMemoryUsage, FormatBytes) },
        { label: "Nível de execução", value: Show(t.puppetRunLevel, Text) },
        { label: "Iniciado em", value: Show(t.puppetStartTime, FormatInstant) },
      ],
      lists: [],
    },
    {
      title: "Rede",
      items: [
        { label: "Interfaces", value: Show(t.networkInfo, Text) },
        { label: "Rede conectada", value: Show(t.connectedNetwork, Text) },
      ],
      lists: [{ label: "Histórico de conexões", entries: Entries(t.connectionHistory) }],
    },
    {
      title: "Tela",
      items: [
        { label: "Resolução", value: Show(t.screenResolution, Text) },
        { label: "HDMI", value: Show(t.hdmiConnected, YesNo("Conectado", "Desconectado")) },
        { label: "Protocolo HDMI", value: Show(t.hdmiProtocol, Text) },
        { label: "Tela", value: Show(t.screenOn, YesNo("Ligada", "Desligada")) },
      ],
      lists: [],
    },
    {
      title: "Modo quiosque",
      items: [
        { label: "Modo quiosque", value: Show(t.kiosKModeEnabled, YesNo("Ativado", "Desativado")) },
        { label: "Login automático", value: Show(t.autoLoginEnabled, YesNo("Ativado", "Desativado")) },
        { label: "Abre ao iniciar o sistema", value: Show(t.startupAppConfigured, YesNo("Configurado", "Não configurado")) },
      ],
      lists: [],
    },
    {
      title: "Estabilidade",
      items: [
        { label: "Reinícios", value: Show(t.restarts, Count) },
        { label: "Falhas (crashes)", value: Show(t.crashes, Count) },
        { label: "Desconexões de HDMI", value: Show(t.hdmiDisconnects, Count) },
        { label: "Mudanças de energia da tela", value: Show(t.screenPowerChanges, Count) },
      ],
      lists: [
        { label: "Suspensões", entries: Entries(t.suspendEvents) },
        { label: "Desligamentos", entries: Entries(t.shutdownTimes) },
        { label: "Inicializações", entries: Entries(t.startupTimes) },
      ],
    },
  ];
}

/** The identifier a device sent when it connected, or a note with its id when it sent none. */
export function DeviceIdentifierText(device: Pick<Device, "id" | "identifier">): string {
  return device.identifier === undefined ? `sem identificador (id ${device.id})` : device.identifier;
}

/** A device's name, or its identifier while it has no name (pending devices). */
export function DeviceDisplayName(device: Pick<Device, "id" | "identifier" | "name">): string {
  return device.name === undefined ? DeviceIdentifierText(device) : device.name;
}
