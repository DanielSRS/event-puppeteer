/**
 * Organization users page (Admin+): searches people by name (the API ignores
 * accents and case), changes roles and removes (deactivates) accounts after
 * confirmation. A Superadmin can also promote someone to Superadmin.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { OrgRole, User } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { SectionDenialFor, SelectOrgNotice, useDashboard } from "../DashboardContext";
import { AccessNotice } from "../global/AccessNotice";
import { ROLE_LABELS } from "../roleLabels";
import { FullName, UserList } from "./UserList";

/** Time without typing before the search runs. */
const SEARCH_DELAY_MS = 300;

/** Results of one search (`query` = what was searched, trimmed). */
type SearchResult = { query: string; users: Result<User[], string> };

/** Loads the people of `orgId` whose name matches `query` (everyone when empty). */
async function LoadUsers(orgId: string, query: string): Promise<Result<User[], string>> {
  const users = await api.users.list(orgId, query === "" ? undefined : query);
  if (!users.ok) return Err(`Não foi possível carregar as pessoas. ${ApiErrorMessage(users.error)}`);
  return Ok([...users.value].sort((a, b) => FullName(a).localeCompare(FullName(b), "pt-BR")));
}

/** The page, guarded by the section rules. */
export function DashboardUsersContainer() {
  const { user, orgId } = useDashboard();
  const denial = SectionDenialFor("users", user, orgId);
  if (denial !== null) return <AccessNotice denial={denial} />;
  if (orgId === null) return <SelectOrgNotice />;
  return <Users key={orgId} orgId={orgId} currentUserId={user.id} isSuperadmin={user.role === "Superadmin"} />;
}

/** The people of one organization; remounted when the organization changes. */
function Users({ orgId, currentUserId, isSuperadmin }: { orgId: string; currentUserId: string; isSuperadmin: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [promoting, setPromoting] = useState<User | null>(null);
  const [promoteError, setPromoteError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    LoadUsers(orgId, query).then((users) => { if (active) setResult({ query, users }); });
    return () => { active = false; };
  }, [orgId, query]);

  /** Replaces or drops one person in the current results. */
  const updateResults = (change: (users: User[]) => User[]) =>
    setResult((current) => current !== null && current.users.ok ? { ...current, users: Ok(change(current.users.value)) } : current);

  const handleChangeRole = async (user: User, role: OrgRole) => {
    setBusyUserId(user.id);
    setFeedback(null);
    const changed = await api.users.changeRole(orgId, user.id, role);
    setBusyUserId(null);

    if (!changed.ok) {
      setFeedback({ ok: false, text: `Não foi possível alterar o papel de ${FullName(user)}. ${ApiErrorMessage(changed.error)}` });
      return;
    }
    const updated = changed.value;
    updateResults((users) => users.map((u) => u.id === updated.id ? updated : u));
    setFeedback({ ok: true, text: `${FullName(updated)} agora é ${ROLE_LABELS[updated.role]}.` });
  };

  const handleConfirmRemove = async () => {
    if (removing === null) return;
    setBusyUserId(removing.id);
    setRemoveError("");
    const removed = await api.users.remove(orgId, removing.id);
    setBusyUserId(null);

    if (!removed.ok) {
      setRemoveError(`Não foi possível remover ${FullName(removing)}. ${ApiErrorMessage(removed.error)}`);
      return;
    }
    const gone = removing;
    updateResults((users) => users.filter((u) => u.id !== gone.id));
    setFeedback({ ok: true, text: `${FullName(gone)} foi removido(a) da organização.` });
    setRemoving(null);
  };

  const handleConfirmPromote = async () => {
    if (promoting === null) return;
    setBusyUserId(promoting.id);
    setPromoteError("");
    const promoted = await api.users.promoteToSuperadmin(orgId, promoting.id);
    setBusyUserId(null);

    if (!promoted.ok) {
      setPromoteError(`Não foi possível promover ${FullName(promoting)}. ${ApiErrorMessage(promoted.error)}`);
      return;
    }
    const person = promoting;
    updateResults((users) => users.filter((u) => u.id !== person.id));
    setFeedback({ ok: true, text: `${FullName(person)} agora é Superadmin e saiu desta organização.` });
    setPromoting(null);
  };

  const searching = result === null || result.query !== search.trim();

  return (
    <div className="column gap-4">
      <div className="column gap-1">
        <label htmlFor="user-search">Buscar por nome</label>
        <input
          id="user-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ex.: maria"
          className="input min-h-10 sm:max-w-sm"
        />
      </div>

      {feedback !== null && (feedback.ok ? <StatusMessage>{feedback.text}</StatusMessage> : <ErrorAlert>{feedback.text}</ErrorAlert>)}

      {result === null ? (
        <LoadingMessage>Carregando pessoas...</LoadingMessage>
      ) : !result.users.ok ? (
        <ErrorAlert>{result.users.error}</ErrorAlert>
      ) : (
        <div className={`column gap-2 ${searching ? "opacity-60" : ""}`} aria-busy={searching}>
          <p role="status" className="text-sm text-foreground/70">
            {searching
              ? "Buscando..."
              : result.users.value.length === 0
                ? (result.query === "" ? "Nenhuma pessoa nesta organização." : `Nenhuma pessoa encontrada para “${result.query}”.`)
                : `${result.users.value.length} ${result.users.value.length === 1 ? "pessoa" : "pessoas"}${result.query === "" ? "" : ` para “${result.query}”`}.`}
          </p>
          {result.users.value.length > 0 && (
            <UserList
              users={result.users.value}
              currentUserId={currentUserId}
              busyUserId={busyUserId}
              onChangeRole={handleChangeRole}
              onRemove={(user) => { setRemoveError(""); setFeedback(null); setRemoving(user); }}
              canPromoteToSuperadmin={isSuperadmin}
              onPromoteToSuperadmin={(user) => { setPromoteError(""); setFeedback(null); setPromoting(user); }}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={removing !== null}
        title={removing === null ? "Remover pessoa?" : `Remover ${FullName(removing)}?`}
        confirmLabel="Sim, remover"
        danger
        busy={busyUserId !== null && removing !== null && busyUserId === removing.id}
        error={removeError}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoving(null)}
      >
        <ul className="list-disc column gap-1 pl-5">
          <li>A pessoa não conseguirá mais entrar na conta.</li>
          <li>Os eventos que ela publicou saem do mural.</li>
          <li>O histórico (auditoria, votos e denúncias) é mantido.</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={promoting !== null}
        title={promoting === null ? "Promover a Superadmin?" : `Promover ${FullName(promoting)} a Superadmin?`}
        confirmLabel="Sim, promover"
        danger
        busy={busyUserId !== null && promoting !== null && busyUserId === promoting.id}
        error={promoteError}
        onConfirm={handleConfirmPromote}
        onCancel={() => setPromoting(null)}
      >
        <ul className="list-disc column gap-1 pl-5">
          <li>A pessoa passa a ter acesso total: todas as organizações, dispositivos, tags e links globais.</li>
          <li>Ela sai desta organização e deixa de aparecer nesta lista.</li>
          <li>O painel não permite desfazer esta ação.</li>
          <li>A promoção fica registrada na auditoria desta organização.</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}
