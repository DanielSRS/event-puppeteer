/**
 * People under shadow ban in the organization: a glass panel listing each
 * person (red initials, name, e-mail) with a button to lift the ban, next to
 * an aside explaining how the shadow ban works. The API doesn't say when or why
 * the ban was applied (that lives in the audit trail), so only who is banned
 * is shown, and the aside links to the audit trail when the viewer may open it.
 *
 * @module
 */

import Link from "next/link";
import { MdArrowForward, MdCheck } from "react-icons/md";
import { Monogram } from "@/utils/monogram";

/** A banned person. */
export type BannedUser = { id: string; name: string; email: string };

export type BanListProps = {
  users: BannedUser[];
  /** Person whose ban is being lifted right now. */
  busyUserId: string | null;
  /** Asks to lift the ban of a person (the container confirms first). */
  onLiftBan: (user: BannedUser) => void;
  /** Where the audit trail is, when the viewer may open it; the aside then links to it. */
  auditHref?: string;
};

/** How the shadow ban works, beside the list. */
function AboutShadowBan({ auditHref }: { auditHref: string | undefined }) {
  return (
    <aside aria-labelledby="ban-about-title" className="glass column flex-[1_1_300px] gap-3 rounded-[26px] p-[22px]">
      <h2 id="ban-about-title" className="h2 text-[19px]">Como funciona o shadow ban</h2>
      <p className="t2">O que a pessoa publica deixa de aparecer para os outros, mas continua visível para ela — ela não é avisada.</p>
      <p className="t2">Ele é aplicado automaticamente quando um evento atinge o limite de denúncias ou quando uma imagem enviada é rejeitada na revisão.</p>
      {auditHref !== undefined && (
        <Link href={auditHref} className="ink focus-ring inline-flex min-h-11 items-center gap-2 self-start rounded-lg font-semibold">
          Ver quando e por quê na Auditoria <MdArrowForward aria-hidden className="h-4 w-4" />
        </Link>
      )}
    </aside>
  );
}

/** The banned people (or an empty state) beside the explanation. */
export function BanList({ users, busyUserId, onLiftBan, auditHref }: BanListProps) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {users.length === 0 ? (
        <div className="glass column min-w-0 flex-[999_1_480px] items-center gap-2 rounded-[26px] px-6 py-14 text-center">
          <span aria-hidden className="c-ok grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--ok-bg)]">
            <MdCheck className="h-[26px] w-[26px]" />
          </span>
          <h2 className="h2 mt-2">Nenhum usuário banido</h2>
          <p className="t2">Ninguém desta organização está em shadow ban.</p>
        </div>
      ) : (
        <section aria-labelledby="ban-list-title" className="glass min-w-0 flex-[999_1_480px] overflow-hidden rounded-[26px]">
          <h2 id="ban-list-title" className="row gap-2 border-b border-[var(--line)] px-5 py-4 text-[15px] font-semibold">
            Em shadow ban <span aria-hidden className="count count-n">{users.length}</span><span className="sr-only">({users.length})</span>
          </h2>
          <ul>
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-3 border-t border-[var(--line)] px-5 py-3.5 first:border-t-0">
                <span aria-hidden className="c-bad grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--bad-bg)] text-sm font-semibold">
                  {Monogram(user.name, 2)}
                </span>
                <div className="column min-w-0 flex-[1_1_160px]">
                  <h3 className="font-semibold break-words">{user.name}</h3>
                  <p className="t3 truncate text-[13px]">{user.email}</p>
                </div>
                <button
                  type="button"
                  disabled={busyUserId === user.id}
                  onClick={() => onLiftBan(user)}
                  className="button focus-ring max-sm:w-full full-narrow"
                >
                  Remover banimento<span className="sr-only"> de {user.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AboutShadowBan auditHref={auditHref} />
    </div>
  );
}
