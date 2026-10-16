import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DeviceTelemetry, type DeviceDetails } from "./DeviceTelemetry";

const NOW = "2026-10-07T15:00:00.000Z";

const DETAILS: DeviceDetails = {
  device: {
    id: "d2", identifier: "active-mac-03", name: "Totem Biblioteca", location: "Biblioteca Central",
    status: "active", organizationId: "o1", connectedAt: NOW,
  },
  status: { isOnline: true, latestHeartbeat: { deviceId: "d2", timestamp: NOW, status: "ok" } },
  telemetry: {
    cpuTemp: 51.5, memoryUsage: 512 * 1024 * 1024, diskTotal: 32 * 1024 ** 3, diskUsage: 8 * 1024 ** 3, uptime: 7200,
    osVersion: "Debian 13", kernelVersion: "6.12", puppetVersion: "1.0.0", puppetCpuUsage: 12.5, puppetMemoryUsage: 64 * 1024 * 1024,
    hdmiConnected: true, screenOn: true, screenResolution: "1920x1080", kiosKModeEnabled: true, restarts: 2,
    startupTimes: ["2026-10-07T12:00:00Z"],
  },
  commands: [
    { id: "c1", deviceId: "d2", type: "update", status: "completed", issuedBy: "u1", issuedAt: NOW, completedAt: NOW, payload: { url: "/u/puppet", sha256: "a".repeat(64), version: "1.1.0" } },
    { id: "c2", deviceId: "d2", type: "restart", status: "failed", issuedBy: "u1", issuedAt: NOW },
  ],
  logs: [
    { id: "l1", deviceId: "d2", level: "info", message: "Puppet iniciado", timestamp: NOW },
    { id: "l2", deviceId: "d2", level: "error", message: "Falha ao baixar banner", timestamp: NOW },
  ],
};

const meta = {
  title: "Dashboard/Devices/DeviceTelemetry",
  component: DeviceTelemetry,
  parameters: { layout: "padded" },
  args: {
    details: DETAILS,
    loadedAt: NOW,
    refreshError: "",
    sending: null,
    onCommand: fn(async () => null),
    onUpdateFile: fn(async () => null),
    updateProgress: "",
    onRefresh: fn(),
  },
} satisfies Meta<typeof DeviceTelemetry>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Telemetry in groups, command history, logs; telemetry requests go straight out. */
export const Online: Story = {
  args: { onCommand: fn(async () => null), onRefresh: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText("Online")).toBeInTheDocument();
    await expect(canvas.getByText("active-mac-03")).toBeInTheDocument();
    for (const group of ["Hardware", "Sistema", "Puppet", "Rede", "Tela", "Modo quiosque", "Estabilidade"])
      await expect(canvas.getByRole("region", { name: group })).toBeInTheDocument();
    await expect(canvas.getByText("51,5 °C")).toBeInTheDocument();
    await expect(canvas.getByText("8,0 GB de 32,0 GB (25,0%)")).toBeInTheDocument();
    await expect(canvas.getAllByText("Não informado").length).toBeGreaterThan(0);
    await expect(canvas.getByRole("rowheader", { name: "Atualizar Puppet" })).toBeInTheDocument();
    await expect(canvas.getByText("Versão 1.1.0 · /u/puppet")).toBeInTheDocument();
    await expect(canvas.getByText("Falhou")).toBeInTheDocument();
    await expect(canvas.getByText("Falha ao baixar banner")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Pedir telemetria" }));
    await expect(args.onCommand).toHaveBeenCalledWith({ type: "request_telemetry" });
    await userEvent.click(canvas.getByRole("button", { name: "Atualizar agora" }));
    await expect(args.onRefresh).toHaveBeenCalled();
  },
};

/** Restart asks for confirmation; cancelling sends nothing. */
export const RestartConfirmed: Story = {
  args: { onCommand: fn(async () => null) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Reiniciar" }));
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await expect(args.onCommand).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Reiniciar" }));
    await expect(canvas.getByRole("alertdialog", { name: "Reiniciar o dispositivo?" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Sim, reiniciar" }));
    await expect(args.onCommand).toHaveBeenCalledWith({ type: "restart" });
  },
};

/** The update form validates before sending, then closes on success. */
export const UpdateWithValidation: Story = {
  args: { onCommand: fn(async () => null) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Atualizar Puppet" }));
    const dialog = within(canvas.getByRole("dialog", { name: "Atualizar o Puppet" }));
    await userEvent.click(dialog.getByLabelText("Informar um endereço"));
    await userEvent.type(dialog.getByLabelText("Endereço do Puppet"), "puppet.bin");
    await userEvent.type(dialog.getByLabelText("SHA-256"), "abc");
    await userEvent.click(dialog.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onCommand).not.toHaveBeenCalled();
    await expect(dialog.getByText(/este tem 3/)).toBeInTheDocument();

    await userEvent.clear(dialog.getByLabelText("Endereço do Puppet"));
    await userEvent.type(dialog.getByLabelText("Endereço do Puppet"), "/updates/puppet");
    await userEvent.clear(dialog.getByLabelText("SHA-256"));
    await userEvent.type(dialog.getByLabelText("SHA-256"), "b".repeat(64));
    await userEvent.type(dialog.getByLabelText("Versão (opcional)"), "1.2.0");
    await userEvent.click(dialog.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onCommand).toHaveBeenCalledWith({ type: "update", payload: { url: "/updates/puppet", sha256: "b".repeat(64), version: "1.2.0" } });
    await waitFor(() => expect(canvas.queryByRole("dialog", { name: "Atualizar o Puppet" })).not.toBeInTheDocument());
  },
};

/** A file is sent through its own handler, with the version typed on the form. */
export const UpdateFromFile: Story = {
  args: { onUpdateFile: fn(async () => null) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Atualizar Puppet" }));
    const dialog = within(canvas.getByRole("dialog", { name: "Atualizar o Puppet" }));
    await userEvent.click(dialog.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onUpdateFile).not.toHaveBeenCalled();
    await expect(dialog.getByText("Escolha o arquivo do Puppet.")).toBeInTheDocument();

    const file = new File(["ELF"], "puppet", { type: "application/octet-stream" });
    await userEvent.upload(dialog.getByLabelText("Arquivo do Puppet"), file);
    await userEvent.type(dialog.getByLabelText("Versão (opcional)"), "1.2.0");
    await userEvent.click(dialog.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onUpdateFile).toHaveBeenCalledWith(file, "1.2.0");
    await waitFor(() => expect(canvas.queryByRole("dialog", { name: "Atualizar o Puppet" })).not.toBeInTheDocument());
  },
};

/** A refused update stays open with the reason. */
export const UpdateRefused: Story = {
  args: { onCommand: fn(async (): Promise<string | null> => "Não foi possível enviar “Atualizar Puppet”. Os dados enviados foram recusados pelo servidor.") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Atualizar Puppet" }));
    const dialog = within(canvas.getByRole("dialog", { name: "Atualizar o Puppet" }));
    await userEvent.click(dialog.getByLabelText("Informar um endereço"));
    await userEvent.type(dialog.getByLabelText("Endereço do Puppet"), "https://cdn.example.org/puppet");
    await userEvent.type(dialog.getByLabelText("SHA-256"), "c".repeat(64));
    await userEvent.click(dialog.getByRole("button", { name: "Enviar atualização" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent("recusados pelo servidor");
  },
};

/** Offline, never sent telemetry, with heartbeat errors and a failed refresh. */
export const OfflineWithProblems: Story = {
  args: {
    details: {
      ...DETAILS,
      status: { isOnline: false, latestHeartbeat: { deviceId: "d2", timestamp: NOW, status: "degraded", errors: ["HDMI desconectado"] } },
      telemetry: null,
      commands: [],
      logs: [],
    },
    refreshError: "Falha ao atualizar; os dados abaixo são os últimos recebidos. Não foi possível falar com o servidor.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Offline")).toBeInTheDocument();
    await expect(canvas.getByText(/ainda não enviou telemetria/)).toBeInTheDocument();
    await expect(canvas.getByText("HDMI desconectado")).toBeInTheDocument();
    await expect(canvas.getByText(/Falha ao atualizar/)).toBeInTheDocument();
    await expect(canvas.getByText("Nenhum comando enviado.")).toBeInTheDocument();
    await expect(canvas.getByText("Nenhum log recebido.")).toBeInTheDocument();
  },
};

/** While a command is sent the command buttons are disabled. */
export const Sending: Story = {
  args: { sending: "restart" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Desligar" })).toBeDisabled();
  },
};
