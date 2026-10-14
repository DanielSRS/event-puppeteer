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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { ApiErrorMessage, type ApiError } from "@/lib/api/client";
import { organizationQuery, organizationsQuery } from "@/lib/query/queries";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { usePrefetch } from "@/lib/query/usePrefetch";
import { UserOrgId } from "@/lib/api/schemas";
import { SortByName } from "@/utils/text";
import { ApplyOrgColor } from "@/lib/theme/theme";
import { AccessDeniedNotice } from "./AccessDeniedNotice";
import { ROLE_LABELS } from "./roleLabels";
import type { ContextOrganization } from "./ContextSwitcher";
import { DashboardProvider, type DashboardSession } from "./DashboardContext";
import { CONTEXT_NOT_REMEMBERED_MESSAGE, ReadStoredContext, StoreContext } from "./DashboardContextStorage";
import { DashboardLayout } from "./DashboardLayout";
import { AccessibleSections, CanAccess, SectionDenialFor, SectionForPath } from "./DashboardSections";
import { SectionWarmups } from "./sectionWarmups";

/** Name shown for the Superadmin's global context. */
const GLOBAL_NAME = "Sistema Global";

/** The Superadmin's choice of context, remembered per user. */
type Choice = {
  /** Whose choice this is; a different user means it must be read again. */
  userId: string;
  /** Organization being managed; `null` = global context. */
  orgId: string | null;
  /** Something the person should know about the context (empty for nothing). */
  notice: string;
};

/** The context a Superadmin starts in: the remembered one when it still exists. */
function StartingChoice(userId: string, organizations: ContextOrganization[]): Choice {
  const stored = ReadStoredContext(userId);
  if (!stored.ok) return { userId, orgId: null, notice: CONTEXT_NOT_REMEMBERED_MESSAGE };

  const saved = stored.value;
  if (saved.kind !== "org") return { userId, orgId: null, notice: "" };
  if (organizations.some((org) => org.id === saved.orgId)) return { userId, orgId: saved.orgId, notice: "" };

  return {
    userId, orgId: null,
    notice: "A organização que você gerenciava da última vez não existe mais. Você está no Sistema Global.",
  };
}

/** Text for a failed load of the organizations the person manages. */
function ShellErrorMessage(superadmin: boolean, error: ApiError): string {
  return superadmin
    ? `Não foi possível carregar as organizações. ${ApiErrorMessage(error)}`
    : `Não foi possível carregar sua organização. ${ApiErrorMessage(error)}`;
}

/** Wraps every dashboard page. */
export function DashboardContainer({ children }: { children: ReactNode }) {
  const { state, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  /** Set on logout, so the shell goes to the home page instead of asking to log in again. */
  const leaving = useRef(false);
  const prefetch = usePrefetch();
  const router = useRouter();
  const pathname = usePathname();
  const user = state.status === "authenticated" ? state.user : null;
  const superadmin = user !== null && user.role === "Superadmin";
  const ownOrgId = user === null ? null : UserOrgId(user);

  const ownOrg = useApiQuery(organizationQuery(ownOrgId === null ? "" : ownOrgId), { enabled: ownOrgId !== null });
  const allOrgs = useApiQuery(organizationsQuery(), { enabled: superadmin });
  const [picked, setPicked] = useState<Choice | null>(null);

  const organizations = useMemo<ContextOrganization[] | null>(() => {
    if (superadmin) return allOrgs.value === null ? null : SortByName(allOrgs.value).map((org) => ({ id: org.id, name: org.name }));
    return ownOrg.value === null ? null : [{ id: ownOrg.value.id, name: ownOrg.value.name }];
  }, [superadmin, allOrgs.value, ownOrg.value]);

  useEffect(() => {
    if (state.status === "anonymous" && !leaving.current) router.replace(`/entrar?redirect=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  /** The Superadmin's context: what they picked in this session, else the remembered one. */
  const choice = user === null || !superadmin || organizations === null
    ? null
    : picked !== null && picked.userId === user.id ? picked : StartingChoice(user.id, organizations);

  const session = useMemo<DashboardSession | null>(() => {
    if (user === null || organizations === null) return null;
    if (!superadmin) return { user, orgId: ownOrgId };
    return choice === null ? null : { user, orgId: choice.orgId };
  }, [user, superadmin, ownOrgId, organizations, choice]);

  // The palette follows the context being managed: the chosen organization's color, the default one for Sistema Global.
  const contextOrgId = session === null ? undefined : session.orgId;
  const contextColor = contextOrgId === undefined || contextOrgId === null
    ? null
    : superadmin
      ? allOrgs.value?.find((org) => org.id === contextOrgId)?.colorScheme ?? null
      : ownOrg.value?.colorScheme ?? null;
  useEffect(() => {
    if (contextOrgId === undefined) return;
    ApplyOrgColor(contextColor);
  }, [contextOrgId, contextColor]);

  if (state.status === "loading") return <LoadingMessage>Carregando painel...</LoadingMessage>;
  if (state.status === "error") return <ErrorAlert className="m-4">{state.message}</ErrorAlert>;
  if (state.status === "anonymous") return <LoadingMessage>Redirecionando para o login...</LoadingMessage>;

  const failure = superadmin ? allOrgs.error : ownOrg.error;
  if (organizations === null && failure !== null) {
    return (
      <div className="column gap-3 p-4">
        <ErrorAlert>{ShellErrorMessage(superadmin, failure)}</ErrorAlert>
        <button
          type="button"
          onClick={superadmin ? allOrgs.refetch : ownOrg.refetch}
          className="button clean min-h-10 self-start"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (organizations === null || session === null) return <LoadingMessage>Carregando painel...</LoadingMessage>;

  const orgId = session.orgId;
  const notice = superadmin && choice !== null ? choice.notice : "";
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
    setPicked({ userId: me.id, orgId: next, notice: saved.ok ? "" : CONTEXT_NOT_REMEMBERED_MESSAGE });

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
        onIntent={(target) => prefetch(...SectionWarmups(target, me, orgId))}
        account={{ name: `${me.firstName} ${me.lastName}`.trim(), roleLabel: ROLE_LABELS[me.role] }}
        onLogout={() => {
          leaving.current = true;
          const result = logout();
          if (result.ok) router.push("/");
          else {
            leaving.current = false;
            setLogoutError(result.error);
          }
        }}
        notices={notice === "" && logoutError === "" ? undefined : (
          <>
            {notice !== "" && <ErrorAlert>{notice}</ErrorAlert>}
            {logoutError !== "" && <ErrorAlert>{logoutError}</ErrorAlert>}
          </>
        )}
      >
        {denial === null
          ? children
          : <AccessDeniedNotice denial={denial} firstSection={first === undefined ? null : first} />}
      </DashboardLayout>
    </DashboardProvider>
  );
}
