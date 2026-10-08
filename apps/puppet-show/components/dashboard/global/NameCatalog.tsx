/**
 * A system-wide list of names with a form to add one: used for the official
 * tags and for the link labels. The API can't delete or rename these, so the
 * list has no such buttons.
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

/** The list plus the creation form. */
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
    <div className="column gap-6 max-w-3xl">
      <form onSubmit={handleSubmit} noValidate className="card column gap-3">
        <div className="column gap-1">
          <label htmlFor="catalog-name">{inputLabel}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="catalog-name"
              value={name}
              onChange={(event) => { setName(event.target.value); setBlank(false); }}
              placeholder={placeholder}
              disabled={saving}
              aria-invalid={blank}
              aria-describedby={blank ? "catalog-name-error" : undefined}
              className={`input min-h-10 flex-1 ${blank ? "input-error" : ""}`}
            />
            <button type="submit" disabled={saving} className="button main min-h-10">
              <MdAdd aria-hidden className="icon" /> {saving ? "Criando..." : submitLabel}
            </button>
          </div>
          {blank && <p id="catalog-name-error" className="error-message">Informe um nome.</p>}
        </div>
        <ErrorAlert>{error}</ErrorAlert>
      </form>

      <section aria-labelledby="catalog-title" className="column gap-3">
        <h2 id="catalog-title" className="subtitle">{title} ({items.length})</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-foreground/70">{emptyText}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sorted.map((item) => (
              <li key={item.id} className="rounded-full border border-muted bg-surface px-3 py-1 text-sm break-all">{item.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
