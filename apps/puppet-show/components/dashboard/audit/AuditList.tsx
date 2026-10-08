/**
 * The audit trail as a table on larger screens and stacked cards on phones.
 * Failed name lookups are shown in the danger colour with their reason.
 *
 * @module
 */

import { MdHistory } from "react-icons/md";
import { AUTOMATIC_ACTOR_LABEL, type AuditRow, type Lookup } from "./auditFormat";
import { FormatInstant } from "./instant";

export type AuditListProps = { rows: AuditRow[] };

/** A looked-up name, or the reason the lookup failed. */
function LookupText({ lookup }: { lookup: Lookup }) {
  if (lookup.ok) return <span className="break-words">{lookup.value}</span>;
  return <span className="break-words text-danger">{lookup.error}</span>;
}

/** Label shown before a value on phones, where the header row is hidden. */
function CellLabel({ children }: { children: string }) {
  return <span aria-hidden className="block text-xs text-foreground/70 md:hidden">{children}</span>;
}

/** The audit trail, or an empty state. */
export function AuditList({ rows }: AuditListProps) {
  if (rows.length === 0) {
    return (
      <div className="column items-center gap-2 rounded-lg border border-dashed border-muted p-8 text-center">
        <MdHistory aria-hidden className="w-12 h-12 text-foreground/50" />
        <h2 className="text-lg font-medium">Nenhum registro de auditoria</h2>
        <p className="text-sm text-foreground/70">Ainda não há ações de moderação ou administração nesta organização.</p>
      </div>
    );
  }

  return (
    <table className="block w-full text-sm md:table">
      <caption className="sr-only">Registro de auditoria, do mais recente para o mais antigo</caption>
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="border-b border-muted text-left">
          <th scope="col" className="p-3 font-semibold">Data</th>
          <th scope="col" className="p-3 font-semibold">Ação</th>
          <th scope="col" className="p-3 font-semibold">Autor</th>
          <th scope="col" className="p-3 font-semibold">Alvo</th>
          <th scope="col" className="p-3 font-semibold">Detalhes</th>
        </tr>
      </thead>
      <tbody className="column gap-3 md:table-row-group">
        {rows.map((row) => (
          <tr key={row.id} className="card block md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent">
            <td className="block py-1 md:table-cell md:p-3 md:align-top md:whitespace-nowrap">
              <CellLabel>Data</CellLabel>
              {FormatInstant(row.createdAt)}
            </td>
            <th scope="row" className="block py-1 text-left font-semibold md:table-cell md:p-3 md:align-top">
              <CellLabel>Ação</CellLabel>
              {row.actionLabel}
            </th>
            <td className="block py-1 md:table-cell md:p-3 md:align-top">
              <CellLabel>Autor</CellLabel>
              {row.actor.kind === "automatic"
                ? <span className="italic">{AUTOMATIC_ACTOR_LABEL}</span>
                : <LookupText lookup={row.actor.name} />}
            </td>
            <td className="block py-1 md:table-cell md:p-3 md:align-top">
              <CellLabel>Alvo</CellLabel>
              <LookupText lookup={row.target} />
            </td>
            <td className="block py-1 md:table-cell md:p-3 md:align-top">
              <CellLabel>Detalhes</CellLabel>
              {row.details.length === 0 ? (
                <span className="text-foreground/70">Sem detalhes</span>
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
  );
}
