/**
 * The Superadmin's list of organizations: one card per organization with its
 * identifier, location, colour and report threshold, and an edit button.
 *
 * @module
 */

import { MdAdd, MdDomain, MdEdit } from "react-icons/md";
import type { Organization } from "@/lib/api/schemas";

export type OrgManagerProps = {
  organizations: Organization[];
  onCreate: () => void;
  onEdit: (org: Organization) => void;
};

/** The organizations, with create and edit buttons. */
export function OrgManager({ organizations, onCreate, onEdit }: OrgManagerProps) {
  const sorted = [...organizations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <section aria-labelledby="orgs-title" className="column gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="orgs-title" className="subtitle row gap-2">
          <MdDomain aria-hidden className="icon" /> Organizações ({organizations.length})
        </h2>
        <button type="button" onClick={onCreate} className="button main min-h-10">
          <MdAdd aria-hidden className="icon" /> Nova organização
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-muted p-6 text-center text-sm text-foreground/70">Nenhuma organização cadastrada.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((org) => (
            <li key={org.id} className="card column gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold break-words">{org.name}</h3>
                  <p className="font-mono text-sm text-foreground/70 break-all">{org.slug}</p>
                </div>
                <button type="button" onClick={() => onEdit(org)} className="button clean min-h-10 shrink-0">
                  <MdEdit aria-hidden className="icon" /> Editar<span className="sr-only"> {org.name}</span>
                </button>
              </div>
              {org.description !== undefined && <p className="text-sm text-foreground/80 break-words">{org.description}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-foreground/70">Local</dt>
                <dd className="break-words">{org.location === undefined ? "Não informado" : org.location}</dd>
                <dt className="text-foreground/70">Coordenadas</dt>
                <dd>{org.latitude === undefined || org.longitude === undefined ? "Não informadas" : `${org.latitude}, ${org.longitude}`}</dd>
                <dt className="text-foreground/70">Site</dt>
                <dd className="break-all">{org.url === undefined ? "Não informado" : org.url}</dd>
                <dt className="text-foreground/70">Cor</dt>
                <dd className="row gap-2">
                  {org.colorScheme === undefined ? "Não informada" : (
                    <>
                      <span aria-hidden className="h-4 w-4 rounded-full border border-muted" style={{ backgroundColor: org.colorScheme }} />
                      <span className="font-mono">{org.colorScheme}</span>
                    </>
                  )}
                </dd>
                <dt className="text-foreground/70">Limite de denúncias</dt>
                <dd>{org.shadowBanThreshold}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
