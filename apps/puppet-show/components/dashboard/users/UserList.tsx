/**
 * People of the organization: name, e-mail, shadow-ban status, a labelled
 * role selector, a remove button and, for a Superadmin, a promote-to-Superadmin
 * button. The logged-in person can't change their
 * own role or remove themselves (the API refuses it too), and the controls
 * say so.
 *
 * Shown as a table on larger screens and as stacked cards on phones.
 *
 * @module
 */

import type { OrgRole, User } from "@/lib/api/schemas";
import { MdAdminPanelSettings, MdPersonRemove } from "react-icons/md";
import { ROLE_LABELS } from "../roleLabels";

/** Roles an Admin can give, lowest first. */
const ORG_ROLES: OrgRole[] = ["Member", "Moderator", "Admin"];

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

/** Label shown before a value on phones, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="block text-xs text-foreground/70 md:hidden">{children}</span>;
}

/** Type guard for the role select's value. */
function IsOrgRole(value: string): value is OrgRole {
  return ORG_ROLES.some((role) => role === value);
}

/** The table of people; the container renders the empty and loading states. */
export function UserList({
  users, currentUserId, busyUserId, onChangeRole, onRemove, canPromoteToSuperadmin, onPromoteToSuperadmin,
}: UserListProps) {
  return (
    <table className="block w-full text-sm md:table">
      <caption className="sr-only">Pessoas da organização</caption>
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="border-b border-muted text-left">
          <th scope="col" className="p-3 font-semibold">Nome</th>
          <th scope="col" className="p-3 font-semibold">E-mail</th>
          <th scope="col" className="p-3 font-semibold">Situação</th>
          <th scope="col" className="p-3 font-semibold">Papel</th>
          <th scope="col" className="p-3 font-semibold"><span className="sr-only">Ações</span></th>
        </tr>
      </thead>
      <tbody className="column gap-3 md:table-row-group">
        {users.map((user) => {
          const name = FullName(user);
          const isMe = user.id === currentUserId;
          const busy = busyUserId === user.id;
          const selfNoteId = `self-note-${user.id}`;

          return (
            <tr key={user.id} className="card block md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent">
              <th scope="row" className="block py-1 text-left font-medium md:table-cell md:p-3 md:align-middle">
                <span className="break-words">{name}</span>
                {isMe && <span className="ml-2 text-xs font-normal text-foreground/70">(você)</span>}
              </th>
              <td className="block py-1 md:table-cell md:p-3 md:align-middle">
                <CellLabel>E-mail</CellLabel>
                <span className="break-all">{user.email}</span>
              </td>
              <td className="block py-1 md:table-cell md:p-3 md:align-middle">
                <CellLabel>Situação</CellLabel>
                {user.isShadowBanned
                  ? <span className="rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger ring-1 ring-inset ring-danger/30">Em shadow ban</span>
                  : <span className="text-foreground/80">Normal</span>}
              </td>
              <td className="block py-1 md:table-cell md:p-3 md:align-middle">
                {user.role === "Superadmin" ? (
                  <>
                    <CellLabel>Papel</CellLabel>
                    {ROLE_LABELS.Superadmin}
                  </>
                ) : (
                  <>
                    <label htmlFor={`role-${user.id}`} className="mb-1 block text-xs md:sr-only">
                      Papel<span className="sr-only"> de {name}</span>
                    </label>
                    <select
                      id={`role-${user.id}`}
                      value={user.role}
                      disabled={isMe || busy}
                      aria-describedby={isMe ? selfNoteId : undefined}
                      onChange={(event) => { if (IsOrgRole(event.target.value)) onChangeRole(user, event.target.value); }}
                      className="input min-h-10 md:w-44"
                    >
                      {ORG_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  </>
                )}
              </td>
              <td className="block pt-2 md:table-cell md:p-3 md:align-middle md:text-right">
                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                {canPromoteToSuperadmin && user.role !== "Superadmin" && !isMe && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPromoteToSuperadmin(user)}
                    className="button clean min-h-10 w-full md:w-auto"
                  >
                    <MdAdminPanelSettings aria-hidden className="icon" /> Promover<span className="sr-only"> {name}</span> a Superadmin
                  </button>
                )}
                {user.role !== "Superadmin" && (
                  <button
                    type="button"
                    disabled={isMe || busy}
                    aria-describedby={isMe ? selfNoteId : undefined}
                    onClick={() => onRemove(user)}
                    className="button clean min-h-10 w-full text-danger md:w-auto"
                  >
                    <MdPersonRemove aria-hidden className="icon" /> Remover<span className="sr-only"> {name}</span>
                  </button>
                )}
                </div>
                {isMe && (
                  <p id={selfNoteId} className="mt-1 text-xs text-foreground/70">
                    Você não pode alterar o próprio papel nem remover a própria conta.
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
