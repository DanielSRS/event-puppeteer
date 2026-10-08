/**
 * People under shadow ban in the organization, each with a button to lift
 * the ban. The API doesn't say when or why the ban was applied (that lives in
 * the audit trail), so only who is banned is shown.
 *
 * @module
 */

import { MdPersonOff, MdShield } from "react-icons/md";

/** A banned person. */
export type BannedUser = { id: string; name: string; email: string };

export type BanListProps = {
  users: BannedUser[];
  /** Person whose ban is being lifted right now. */
  busyUserId: string | null;
  /** Asks to lift the ban of a person (the container confirms first). */
  onLiftBan: (user: BannedUser) => void;
};

/** The banned people, or an empty state. */
export function BanList({ users, busyUserId, onLiftBan }: BanListProps) {
  if (users.length === 0) {
    return (
      <div className="column items-center gap-2 rounded-lg border border-dashed border-muted p-8 text-center">
        <MdShield aria-hidden className="w-12 h-12 text-foreground/50" />
        <h2 className="text-lg font-medium">Nenhum usuário banido</h2>
        <p className="text-sm text-foreground/70">Ninguém desta organização está em shadow ban.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="ban-list-title" className="column gap-3">
      <h2 id="ban-list-title" className="subtitle">Em shadow ban ({users.length})</h2>
      <ul className="column gap-3">
        {users.map((user) => (
          <li key={user.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="row gap-3 min-w-0">
              <span className="center h-10 w-10 shrink-0 rounded-full bg-danger/10">
                <MdPersonOff aria-hidden className="h-5 w-5 text-danger" />
              </span>
              <div className="min-w-0">
                <h3 className="font-medium break-words">{user.name}</h3>
                <p className="text-sm text-foreground/70 break-all">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busyUserId === user.id}
              onClick={() => onLiftBan(user)}
              className="button clean min-h-10 shrink-0"
            >
              Remover banimento<span className="sr-only"> de {user.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
