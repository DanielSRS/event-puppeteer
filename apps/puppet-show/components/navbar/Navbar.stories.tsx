import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { User } from "@/lib/api/schemas";
import { Navbar } from "./Navbar";
import { LOGO_THUMBHASH, LOGO_URL } from "@/components/ui/storyImages";

const MEMBER: User = {
  id: "1",
  firstName: "Maria",
  lastName: "Souza",
  normalizedName: "maria souza",
  email: "maria@uefs.br",
  organizationId: "org-1",
  role: "Member",
  isShadowBanned: false,
};

/**
 * The top bar. Story tests run at 1200 px, so these assert the wide layout
 * (inline links, greeting); the phone menu (button, `aria-expanded`, Escape)
 * is covered end to end in `e2e/specs/public-navbar.spec.ts`.
 */
const meta = {
  title: "Components/Navbar/Navbar",
  component: Navbar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    auth: { status: "anonymous" },
    brand: { name: "Universidade Estadual", logo: null },
    brandError: null,
    pathname: "/",
    logoutError: null,
    onLogout: fn(),
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The links of the wide layout (the phone menu holds a hidden copy). */
function Visible(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter((element) => element.offsetParent !== null);
}

/** Visitor: organization name, Mural (current), Modo TV, Entrar, Criar conta. */
export const Anonymous: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /Universidade Estadual/ })).toHaveAttribute("href", "/");
    const links = Visible(canvas.getAllByRole("link")).map((link) => link.textContent);
    await expect(links).toEqual(["Universidade EstadualMural de Eventos", "Mural", "Modo TV", "Entrar", "Criar conta"]);
    await expect(Visible(canvas.getAllByRole("link", { name: "Mural" }))[0]).toHaveAttribute("aria-current", "page");
  },
};

/** The organization's logo sits next to its name, drawn over its Placeholder. */
export const WithLogo: Story = {
  args: { brand: { name: "Universidade Estadual", logo: { url: LOGO_URL, thumbhash: LOGO_THUMBHASH } } },
  play: async ({ canvas }) => {
    const home = canvas.getByRole("link", { name: /Universidade Estadual/ });
    await expect(home.querySelector("img")).toHaveAttribute("src", LOGO_URL);
  },
};

/** Logged in: greeting, Painel, Publicar and Sair. */
export const LoggedIn: Story = {
  args: { auth: { status: "authenticated", user: MEMBER }, pathname: "/dashboard/events" },
  play: async ({ canvas, args }) => {
    await expect(Visible(canvas.getAllByText("Olá, Maria"))).toHaveLength(1);
    const painel = Visible(canvas.getAllByRole("link", { name: "Painel" }))[0];
    await expect(painel).toHaveAttribute("href", "/dashboard");
    await expect(painel).toHaveAttribute("aria-current", "page");
    await expect(Visible(canvas.getAllByRole("link", { name: "Publicar" }))[0]).toHaveAttribute("href", "/eventos/novo");
    await expect(canvas.queryAllByRole("link", { name: "Entrar" })).toHaveLength(0);
    await userEvent.click(Visible(canvas.getAllByRole("button", { name: "Sair" }))[0]);
    await expect(args.onLogout).toHaveBeenCalled();
  },
};

/** The Superadmin belongs to no organization: the app name is shown. */
export const Superadmin: Story = {
  args: {
    brand: null,
    auth: { status: "authenticated", user: { id: "s", firstName: "Sara", lastName: "Super", normalizedName: "sara super", email: "s@x", role: "Superadmin", isShadowBanned: false } },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Mural de Eventos" })).toBeInTheDocument();
  },
};

export const LoadingSession: Story = {
  args: { auth: { status: "loading" }, brand: null },
};

/** Session, organization and logout problems are shown under the bar. */
export const Errors: Story = {
  args: {
    auth: { status: "error", message: "O navegador bloqueou o armazenamento local." },
    brand: null,
    brandError: "Não foi possível carregar a organização.",
    logoutError: "Não foi possível sair.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("alert")).toHaveLength(3);
  },
};
