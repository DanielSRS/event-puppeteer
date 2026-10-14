/**
 * The Superadmin's list of organizations: the page header with "Nova
 * organização", then one card per organization showing its own palette, its
 * identifier, location, colour and report threshold, and an edit button.
 *
 * @module
 */

import type { ReactNode } from "react";
import { MdAdd, MdEdit } from "react-icons/md";
import { PageHeader } from "@/components/dashboard/page-header";
import { OrgGradient, OrgInk } from "@/lib/theme/org-palette";
import type { Organization } from "@/lib/api/schemas";
import { DEFAULT_ORG_COLOR, IsHexColor } from "@/lib/theme/theme";
import { Monogram } from "@/utils/monogram";

export type OrgManagerProps = {
  organizations: Organization[];
  onCreate: () => void;
  onEdit: (org: Organization) => void;
  /** Result of the last save, shown under the header. */
  notice?: ReactNode;
};

/** Header shared by the loaded page and its loading/error states. */
export function OrgsHeader({ onCreate }: { onCreate?: () => void }) {
  return (
    <PageHeader
      badge={{ label: "Sistema Global", tone: "info" }}
      title="Organizações"
      description="Cada organização tem seu mural, seus totens e sua equipe, e a própria paleta, gerada pela cor principal. Para agir como Admin de uma delas, troque o contexto no menu."
      actions={onCreate === undefined ? undefined : (
        <button type="button" onClick={onCreate} className="button main min-h-12 px-5 text-[15px]">
          <MdAdd aria-hidden className="icon" /> Nova organização
        </button>
      )}
    />
  );
}

/** The organizations, with create and edit buttons. */
export function OrgManager({ organizations, onCreate, onEdit, notice }: OrgManagerProps) {
  const sorted = [...organizations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="column gap-[22px]">
      <OrgsHeader onCreate={onCreate} />
      {notice}

      <section aria-labelledby="orgs-title" className="column gap-3">
        <h2 id="orgs-title" className="sr-only">Organizações ({organizations.length})</h2>
        {sorted.length === 0 ? (
          <p className="glass rounded-[26px] p-8 text-center t2">Nenhuma organização cadastrada.</p>
        ) : (
          <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))]">
            {sorted.map((org) => {
              const color = IsHexColor(org.colorScheme) ? org.colorScheme : DEFAULT_ORG_COLOR;
              return (
                <li key={org.id} className="glass lift column overflow-hidden rounded-[26px]">
                  <div aria-hidden className="relative h-[92px]" style={{ background: OrgGradient(color) }}>
                    <span
                      className="absolute -bottom-7 left-5 grid h-16 w-16 place-items-center rounded-[20px] font-display text-[15px] font-extrabold"
                      style={{ background: color, color: OrgInk(color), boxShadow: "0 0 0 4px var(--glass-strong)" }}
                    >
                      {Monogram(org.name)}
                    </span>
                  </div>

                  <div className="column flex-1 gap-3.5 px-5 pb-5 pt-[38px]">
                    <div className="column gap-0.5">
                      <h3 className="h2 text-xl break-words">{org.name}</h3>
                      <span className="mono t3 text-[12.5px] break-all">{org.slug}</span>
                    </div>
                    {org.description !== undefined && <p className="t2 text-sm break-words">{org.description}</p>}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
                      <dt className="t3">Local</dt>
                      <dd className={`break-words ${org.location === undefined ? "t3" : ""}`}>{org.location ?? "Não informado"}</dd>
                      <dt className="t3">Coordenadas</dt>
                      {org.latitude === undefined || org.longitude === undefined
                        ? <dd className="t3">Não informadas</dd>
                        : <dd className="mono">{`${org.latitude}, ${org.longitude}`}</dd>}
                      <dt className="t3">Site</dt>
                      <dd className={`break-all ${org.url === undefined ? "t3" : ""}`}>{org.url ?? "Não informado"}</dd>
                      <dt className="t3">Cor</dt>
                      <dd className="row gap-2">
                        {org.colorScheme === undefined ? <span className="t3">Não informada</span> : (
                          <>
                            <span aria-hidden className="h-3.5 w-3.5 rounded" style={{ backgroundColor: org.colorScheme }} />
                            <span className="mono">{org.colorScheme}</span>
                          </>
                        )}
                      </dd>
                      <dt className="t3">Limite de denúncias</dt>
                      <dd>{org.shadowBanThreshold} {org.shadowBanThreshold === 1 ? "denúncia" : "denúncias"}</dd>
                    </dl>
                    <button type="button" onClick={() => onEdit(org)} className="button mt-auto">
                      <MdEdit aria-hidden className="icon" /> Editar<span className="sr-only"> {org.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
