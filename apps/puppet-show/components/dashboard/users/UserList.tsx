/**
 * People of the organization: avatar, name and e-mail, shadow-ban status as a
 * badge, a labelled role selector, a remove button and, for a Superadmin, a
 * promote-to-Superadmin button. The logged-in person can't change their own
 * role or remove themselves (the API refuses it too); the note under the
 * table says so and describes their disabled controls.
 *
 * A table that becomes stacked cards when the dashboard column is narrow
 * (`.rtable`); the container draws the card around it.
 *
 * @module
 */

import type { OrgRole, User } from "@/lib/api/schemas";
import { MdArrowUpward } from "react-icons/md";
import { ROLE_LABELS } from "../roleLabels";

/** Roles an Admin can give, lowest first. */
const ORG_ROLES: OrgRole[] = ["Member", "Moderator", "Admin"];

/** Id of the note that explains why the viewer's own controls are disabled. */
const SELF_NOTE_ID = "users-self-note";

export type UserListProps = {
  users: User[];
  /** The logged-in person, whose own controls are disabled. */
  currentUserId: string;
  /** Person being changed or removed right now; their controls are disabled. */
  busyUserId: string | null;
  onChangeRole: (user: User, role: OrgRole) => void;
  /** Asks to remove a person (the container confirms first). */
  onRemove: (user: User) => void;
  /** Whether the viewer is a Superadmin, the only role that can create other Superadmins. */
  canPromoteToSuperadmin: boolean;
  /** Asks to promote a person to Superadmin (the container confirms first). */
  onPromoteToSuperadmin: (user: User) => void;
};

/** `"Maria Membro"`. */
export function FullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

/** `"MM"` for Maria Membro. */
function Initials(user: User): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

/** Label shown before a value when the table is stacked, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="cell-label">{children}</span>;
}

/** Type guard for the role select's value. */
function IsOrgRole(value: string): value is OrgRole {
  return ORG_ROLES.some((role) => role === value);
}

/** The table of people and the note about one's own account; the container renders the empty and loading states. */
export function UserList({
  users, currentUserId, busyUserId, onChangeRole, onRemove, canPromoteToSuperadmin, onPromoteToSuperadmin,
}: UserListProps) {
  return (
    <>
      <table className="rtable text-sm">
        <caption className="sr-only">Pessoas da organização</caption>
        <thead>
          <tr>
            <th scope="col" className="pl-5">Nome</th>
            <th scope="col">Situação</th>
            <th scope="col">Papel</th>
            <th scope="col" className="pr-5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const name = FullName(user);
            const isMe = user.id === currentUserId;
            const busy = busyUserId === user.id;

            return (
              <tr key={user.id}>
                <th scope="row" className="pl-5 font-normal">
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="avatar">{Initials(user)}</span>
                    <span className="column min-w-0 leading-snug">
                      <span className="font-semibold break-words">
                        {name}
                        {isMe && <span className="t2 font-normal"> (você)</span>}
                      </span>
                      <span className="t3 text-[13px] break-all">{user.email}</span>
                    </span>
                  </span>
                </th>
                <td>
                  <CellLabel>Situação</CellLabel>
                  {user.isShadowBanned
                    ? <span className="badge b-bad">Em shadow ban</span>
                    : <span className="badge b-neutral">Normal</span>}
                </td>
                <td>
                  {user.role === "Superadmin" ? (
                    <>
                      <CellLabel>Papel</CellLabel>
                      <span className="badge b-violet">{ROLE_LABELS.Superadmin}</span>
                    </>
                  ) : (
                    <>
                      <label htmlFor={`role-${user.id}`} className="sr-only">Papel de {name}</label>
                      <span className="relative flex w-full max-w-[200px]">
                        <select
                          id={`role-${user.id}`}
                          value={user.role}
                          disabled={isMe || busy}
                          aria-describedby={isMe ? SELF_NOTE_ID : undefined}
                          onChange={(event) => { if (IsOrgRole(event.target.value)) onChangeRole(user, event.target.value); }}
                          className="input min-h-11 appearance-none pr-9"
                        >
                          {ORG_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                        </select>
                        <svg
                          aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round"
                          className="t2 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </>
                  )}
                </td>
                <td className="pr-5">
                  <span className="flex flex-wrap justify-end gap-1.5 [@container_dash_(max-width:760px)]:justify-start [@container_dash_(max-width:760px)]:pt-1">
                    {canPromoteToSuperadmin && user.role !== "Superadmin" && !isMe && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPromoteToSuperadmin(user)}
                        className="button focus-ring px-3 text-[13px]"
                      >
                        <MdArrowUpward aria-hidden className="h-4 w-4" /> Promover<span className="sr-only"> {name}</span> a Superadmin
                      </button>
                    )}
                    {user.role !== "Superadmin" && (
                      <button
                        type="button"
                        disabled={isMe || busy}
                        aria-describedby={isMe ? SELF_NOTE_ID : undefined}
                        onClick={() => onRemove(user)}
                        className="button danger-soft focus-ring px-3 text-[13px]"
                      >
                        Remover<span className="sr-only"> {name}</span>
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p id={SELF_NOTE_ID} className="t3 flex items-center gap-2 border-t border-[color:var(--line)] px-5 py-3.5 text-[13px]">
        <svg
          aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
          strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Você não pode alterar o próprio papel nem remover a própria conta.
      </p>
    </>
  );
}
