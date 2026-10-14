/**
 * A system-wide list of names with a form to add one: used for the official
 * tags and for the link labels. The creation form is a glass bar (input plus
 * button); below it, a glass card lists the names as chips with their count.
 * The API can't delete or rename these, so the list has no such buttons.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdAdd } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";

export type NameCatalogProps = {
  /** Heading of the list, e.g. "Tags oficiais". */
  title: string;
  /** Label of the name input, e.g. "Nome da nova tag". */
  inputLabel: string;
  /** Placeholder of the input. */
  placeholder: string;
  /** Text of the submit button, e.g. "Criar tag". */
  submitLabel: string;
  /** Shown when the list is empty. */
  emptyText: string;
  items: Array<{ id: string; name: string }>;
  /** While true the form is disabled. */
  saving: boolean;
  /** Why the last creation failed. */
  error: string;
  /** Creates an item; resolves `true` when it worked, so the input is cleared. */
  onCreate: (name: string) => Promise<boolean>;
};

/** The creation form plus the list. */
export function NameCatalog({ title, inputLabel, placeholder, submitLabel, emptyText, items, saving, error, onCreate }: NameCatalogProps) {
  const [name, setName] = useState("");
  const [blank, setBlank] = useState(false);
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") { setBlank(true); return; }
    setBlank(false);
    if (await onCreate(trimmed)) setName("");
  };

  return (
    <div className="column gap-[22px]">
      <div className="column gap-2.5">
        <form onSubmit={handleSubmit} noValidate aria-label={submitLabel} className="glass flex flex-wrap gap-2.5 rounded-[22px] p-2.5">
          <label htmlFor="catalog-name" className="sr-only">{inputLabel}</label>
          <input
            id="catalog-name"
            value={name}
            onChange={(event) => { setName(event.target.value); setBlank(false); }}
            placeholder={placeholder}
            disabled={saving}
            aria-invalid={blank}
            aria-describedby={blank ? "catalog-name-error" : undefined}
            className={`input min-h-[50px] min-w-0 flex-[1_1_240px] ${blank ? "input-error" : ""}`}
          />
          <button type="submit" disabled={saving} className="button main min-h-[50px] px-5 max-sm:w-full">
            <MdAdd aria-hidden className="icon" /> {saving ? "Criando..." : submitLabel}
          </button>
        </form>
        {blank && <p id="catalog-name-error" className="error-message px-2.5">Informe um nome.</p>}
        <ErrorAlert>{error}</ErrorAlert>
      </div>

      <section aria-labelledby="catalog-title" className="glass column gap-4 rounded-[26px] p-[22px]">
        <h2 id="catalog-title" className="h2 flex items-center gap-2.5 text-xl">
          {title}{" "}<span aria-hidden className="count count-n">{items.length}</span><span className="sr-only">({items.length})</span>
        </h2>
        {sorted.length === 0 ? (
          <p className="t2 text-sm">{emptyText}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sorted.map((item) => (
              <li key={item.id} className="chip px-4 py-[9px] text-sm break-all">{item.name}</li>
            ))}
          </ul>
        )}
        <p className="t3 text-[13px]">Nomes não podem ser renomeados nem excluídos depois de criados.</p>
      </section>
    </div>
  );
}
