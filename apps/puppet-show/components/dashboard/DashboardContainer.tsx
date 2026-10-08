/**
 * The dashboard shell: session, context and access control for every
 * `/dashboard/*` page.
 *
 * - Anonymous visitors go to `/entrar` and come back afterwards.
 * - Members, moderators and admins always manage their own organization.
 * - A Superadmin picks the global context or any organization; the choice is
 *   remembered per user in `localStorage` (a visible notice says so when the
 *   browser blocks storage).
 * - Every route is guarded with {@link SectionDenialFor}: a page the person
 *   can't open in the current context shows why instead of rendering.
 * - Switching context while on a page that isn't available in the new one
 *   moves to the first section that is.
 *
 * @module
 */

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { User } from "@/lib/api/schemas";
import { AccessDeniedNotice } from "./AccessDeniedNotice";
import type { ContextOrganization } from "./ContextSwitcher";
import { DashboardProvider, type DashboardSession } from "./DashboardContext";
import { CONTEXT_NOT_REMEMBERED_MESSAGE, ReadStoredContext, StoreContext } from "./DashboardContextStorage";
import { DashboardLayout } from "./DashboardLayout";
import { AccessibleSections, CanAccess, SectionDenialFor, SectionForPath } from "./DashboardSections";

/** Name shown for the Superadmin's global context. */
const GLOBAL_NAME = "Sistema Global";

/** Where the shell stands once the session is known. */
type Shell =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
    status: "ready";
    /** Whose shell this is; a different user means it must be loaded again. */
    userId: string;
    organizations: ContextOrganization[];
    /** Organization being managed; `null` = global context. */
    orgId: string | null;
    /** Something the person should know about the context (empty for nothing). */
    notice: string;
  };

/** Loads the organizations `user` can manage and the context to start in. */
async function LoadShell(user: User): Promise<Shell> {
  if (user.role !== "Superadmin") {
    const org = await api.organizations.get(user.organizationId);
    if (!org.ok) return { status: "error", message: `Não foi possível carregar sua organização. ${ApiErrorMessage(org.error)}` };
    return {
      status: "ready", userId: user.id, organizations: [{ id: org.value.id, name: org.value.name }],
      orgId: user.organizationId, notice: "",
    };
  }

  const orgs = await api.organizations.list();
  if (!orgs.ok) return { status: "error", message: `Não foi possível carregar as organizações. ${ApiErrorMessage(orgs.error)}` };
  const organizations = orgs.value.map((org) => ({ id: org.id, name: org.name }));

  const stored = ReadStoredContext(user.id);
  if (!stored.ok) return { status: "ready", userId: user.id, organizations, orgId: null, notice: CONTEXT_NOT_REMEMBERED_MESSAGE };

  const saved = stored.value;
  if (saved.kind !== "org") return { status: "ready", userId: user.id, organizations, orgId: null, notice: "" };
  if (organizations.some((org) => org.id === saved.orgId))
    return { status: "ready", userId: user.id, organizations, orgId: saved.orgId, notice: "" };

  return {
    status: "ready", userId: user.id, organizations, orgId: null,
    notice: "A organização que você gerenciava da última vez não existe mais. Você está no Sistema Global.",
  };
}

/** Wraps every dashboard page. */
export function DashboardContainer({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const user = state.status === "authenticated" ? state.user : null;

  const [shell, setShell] = useState<Shell>({ status: "loading" });

  useEffect(() => {
    if (state.status === "anonymous") router.replace(`/entrar?redirect=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  useEffect(() => {
    if (user === null) return;
    let active = true;
    LoadShell(user).then((next) => { if (active) setShell(next); });
    return () => { active = false; };
  }, [user]);

  const session = useMemo<DashboardSession | null>(
    () => (user !== null && shell.status === "ready" ? { user, orgId: shell.orgId } : null),
    [user, shell],
  );

  if (state.status === "loading") return <LoadingMessage>Carregando painel...</LoadingMessage>;
  if (state.status === "error") return <ErrorAlert className="m-4">{state.message}</ErrorAlert>;
  if (state.status === "anonymous") return <LoadingMessage>Redirecionando para o login...</LoadingMessage>;

  if (shell.status === "error") {
    return (
      <div className="column gap-3 p-4">
        <ErrorAlert>{shell.message}</ErrorAlert>
        <button
          type="button"
          onClick={async () => { setShell({ status: "loading" }); setShell(await LoadShell(state.user)); }}
          className="button clean min-h-10 self-start"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (shell.status === "loading" || session === null || shell.userId !== state.user.id)
    return <LoadingMessage>Carregando painel...</LoadingMessage>;

  const { organizations, orgId, notice } = shell;
  const current = organizations.find((org) => org.id === orgId);
  if (orgId !== null && current === undefined)
    return <ErrorAlert className="m-4">A organização {orgId} não está entre as que você pode gerenciar.</ErrorAlert>;
  const contextName = current === undefined ? GLOBAL_NAME : current.name;

  const me = state.user;
  const section = SectionForPath(pathname);
  const denial = section === null ? null : SectionDenialFor(section, me, orgId);
  const first = AccessibleSections(me, orgId).at(0);

  function selectContext(next: string | null) {
    const saved = StoreContext(me.id, next);
    setShell((prev) => prev.status === "ready"
      ? { ...prev, orgId: next, notice: saved.ok ? "" : CONTEXT_NOT_REMEMBERED_MESSAGE }
      : prev);

    if (section === null) return;
    const target = CanAccess(section, me, next)
      ? AccessibleSections(me, next).find((candidate) => candidate.id === section)
      : AccessibleSections(me, next).at(0);
    if (target !== undefined && target.href !== pathname) router.push(target.href);
  }

  return (
    <DashboardProvider value={session}>
      <DashboardLayout
        role={me.role}
        orgId={orgId}
        contextName={contextName}
        organizations={organizations}
        pathname={pathname}
        onSelectOrg={selectContext}
        notices={notice === "" ? undefined : <ErrorAlert>{notice}</ErrorAlert>}
      >
        {denial === null
          ? children
          : <AccessDeniedNotice denial={denial} firstSection={first === undefined ? null : first} />}
      </DashboardLayout>
    </DashboardProvider>
  );
}
