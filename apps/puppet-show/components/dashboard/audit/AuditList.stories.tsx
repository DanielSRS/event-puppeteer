import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Err, Ok } from "@/lib/result";
import { AuditList } from "./AuditList";

const meta = {
  title: "Dashboard/Audit/AuditList",
  component: AuditList,
  parameters: { layout: "padded" },
  args: {
    rows: [
      {
        id: "a1",
        action: "hide_event",
        actionLabel: "Evento ocultado",
        createdAt: "2026-10-07T15:00:00Z",
        actor: { kind: "automatic" },
        target: Ok("Evento “Feira de Ciências”"),
        details: [Ok("Motivo: o evento atingiu o limite de denúncias da organização.")],
      },
      {
        id: "a2",
        action: "remove_user",
        actionLabel: "Usuário removido",
        createdAt: "2026-10-06T12:00:00Z",
        actor: { kind: "user", name: Ok("Ana Admin (admin@uefs.br)") },
        target: Err("Usuário não encontrado entre as pessoas ativas da organização"),
        details: [Ok("2 eventos excluídos junto com a conta.")],
      },
      {
        id: "a3",
        action: "update_org_threshold",
        actionLabel: "Limite de denúncias alterado",
        createdAt: "2026-10-05T12:00:00Z",
        actor: { kind: "user", name: Ok("Ana Admin (admin@uefs.br)") },
        target: Ok("Esta organização"),
        details: [],
      },
    ],
  },
} satisfies Meta<typeof AuditList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Automatic and manual actions, with a target that couldn't be identified. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: /Registro de auditoria/ })).toBeInTheDocument();
    await expect(canvas.getByRole("rowheader", { name: /Evento ocultado/ })).toBeInTheDocument();
    await expect(canvas.getByText("Automático (limite de denúncias)")).toBeInTheDocument();
    await expect(canvas.getByText(/Usuário não encontrado/)).toHaveClass("text-danger");
    await expect(canvas.getByText("Sem detalhes")).toBeInTheDocument();
  },
};

/** Nothing recorded yet. */
export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Nenhum registro de auditoria" })).toBeInTheDocument();
  },
};
