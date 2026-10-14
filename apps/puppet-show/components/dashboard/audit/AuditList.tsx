/**
 * The audit trail in a glass card: a table with the date, the action as a
 * coloured badge, who did it, what it was done to and the details. When the
 * dashboard column is narrow the table becomes stacked cards (`.rtable`).
 * Failed name lookups are shown in the danger colour with their reason.
 *
 * @module
 */

import { MdHistory } from "react-icons/md";
import type { AuditAction } from "@/lib/api/schemas";
import { AUTOMATIC_ACTOR_LABEL, type AuditRow, type Lookup } from "./auditFormat";
import { FormatInstant } from "./instant";

export type AuditListProps = { rows: AuditRow[] };

/** Badge colour of each action: removals red, restorations green, reviews amber, settings blue, tags violet. */
const ACTION_TONES: Record<AuditAction, string> = {
  hide_event: "b-bad",
  unhide_event: "b-ok",
  apply_shadow_ban: "b-bad",
  lift_shadow_ban: "b-ok",
  promote_tag: "b-violet",
  update_org_threshold: "b-info",
  remove_user: "b-bad",
  change_role: "b-info",
  approve_image: "b-ok",
  reject_image: "b-warn",
  update_screening_policy: "b-info",
};

/** A looked-up name, or the reason the lookup failed. */
function LookupText({ lookup }: { lookup: Lookup }) {
  if (lookup.ok) return <span className="break-words">{lookup.value}</span>;
  return <span className="break-words text-danger">{lookup.error}</span>;
}

/** Label shown before a value when the table is stacked, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="cell-label">{children}</span>;
}

/** The date in regular weight and the time in mono, as `"07/10/2026"` + `"12:04"`. */
function When({ iso }: { iso: string }) {
  const [day, time] = FormatInstant(iso).split(", ");
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-medium">{day}</span>
      {time !== undefined && <span className="mono t3 text-xs">{time}</span>}
    </span>
  );
}

/** The audit trail, or an empty state. */
export function AuditList({ rows }: AuditListProps) {
  if (rows.length === 0) {
    return (
      <div className="glass column items-center gap-2 rounded-[26px] px-6 py-12 text-center">
        <span aria-hidden className="surface-2 mb-1 grid h-14 w-14 place-items-center rounded-[18px] t2">
          <MdHistory className="h-7 w-7" />
        </span>
        <h2 className="h2">Nenhum registro de auditoria</h2>
        <p className="t2 max-w-[44ch] text-sm">Ainda não há ações de moderação ou administração nesta organização.</p>
      </div>
    );
  }

  return (
    <section className="glass overflow-hidden rounded-[26px]">
      <table className="rtable text-sm">
        <caption className="sr-only">Registro de auditoria, do mais recente para o mais antigo</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[150px] pl-5">Data</th>
            <th scope="col">Ação</th>
            <th scope="col">Autor</th>
            <th scope="col">Alvo</th>
            <th scope="col" className="pr-5">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="whitespace-nowrap pl-5 align-top">
                <When iso={row.createdAt} />
              </td>
              <th scope="row" className="align-top font-semibold">
                <span className={`badge ${ACTION_TONES[row.action]}`}>{row.actionLabel}</span>
              </th>
              <td className="align-top">
                <CellLabel>Autor</CellLabel>
                {row.actor.kind === "automatic"
                  ? <span className="t3 italic">{AUTOMATIC_ACTOR_LABEL}</span>
                  : <LookupText lookup={row.actor.name} />}
              </td>
              <td className="align-top font-medium">
                <CellLabel>Alvo</CellLabel>
                <LookupText lookup={row.target} />
              </td>
              <td className="t2 max-w-[44ch] pr-5 align-top">
                {row.details.length === 0 ? (
                  <span className="t3">Sem detalhes</span>
                ) : (
                  <ul className="column gap-1">
                    {row.details.map((detail, index) => <li key={index}><LookupText lookup={detail} /></li>)}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
