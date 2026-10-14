/**
 * Step 3 of the event editor: tags, external links and the banner, picked and
 * cropped to 16:9 here and uploaded once the event is published.
 *
 * Three groups titled like small headings. System-defined tags are toggle pills. A free-form tag is created by name
 * (any logged-in person may suggest one); it is attached to the event but
 * stays hidden on the public pages until a moderator promotes it, and is
 * listed with a dashed outline. Each link is one row: type, address and a
 * remove button (their labels are read by screen readers only).
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdAdd, MdClose, MdDeleteOutline } from "react-icons/md";
import { BlobPreview } from "@/components/ui/BlobPreview";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { BANNER_RULES } from "@/utils/crop";
import type { LinkLabel, Tag } from "@/lib/api/schemas";
import type { Result } from "@/lib/result";
import {
  ValidateNewTag, type EventFormData, type EventFormErrors, type EventLinkForm,
} from "@/utils/validation/EventValidation";
import { FIELD, FIELD_HINT, FIELD_LABEL, FieldA11y, FieldError, FieldId } from "./EventFormField";

/** Title of each group (tags, links, banner), drawn like a small heading. */
const LEGEND = "mb-2.5 p-0 text-[15px] font-semibold";

/** Props of {@link EventFormMedia}. */
export type EventFormMediaProps = {
  /** Prefix of every element id in the editor. */
  idPrefix: string;
  data: EventFormData;
  /** Errors to show (only for steps the person already tried to leave). */
  errors: EventFormErrors;
  disabled: boolean;
  /** Every tag known to the system; only the system-defined ones are offered as chips. */
  tags: Tag[];
  /** Labels a link can have. */
  linkLabels: LinkLabel[];
  onChange: (patch: Partial<EventFormData>) => void;
  /** Adds an empty link row. */
  onAddLink: () => void;
  /**
   * Creates (or finds, when the name is taken) a free-form tag by name. The
   * error is a message for the person.
   */
  onCreateTag: (name: string) => Promise<Result<Tag, string>>;
};

/** Tags, links and banner. */
export function EventFormMedia({
  idPrefix, data, errors, disabled, tags, linkLabels, onChange, onAddLink, onCreateTag,
}: EventFormMediaProps) {
  const [newTag, setNewTag] = useState("");
  const [newTagError, setNewTagError] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const id = (path: string) => FieldId(idPrefix, path);
  const systemTags = tags.filter((tag) => tag.isSystemDefined);
  const selectedIds = new Set(data.tags.map((tag) => tag.id));
  const freeFormSelected = data.tags.filter((tag) => !tag.isSystemDefined);
  const freeFormHint = id("newTag-hint");

  function toggleTag(tag: Tag) {
    onChange({ tags: selectedIds.has(tag.id) ? data.tags.filter((t) => t.id !== tag.id) : [...data.tags, tag] });
  }

  async function addFreeFormTag() {
    const invalid = ValidateNewTag(newTag).newTag;
    if (invalid !== undefined) {
      setNewTagError(invalid);
      return;
    }
    setCreatingTag(true);
    setNewTagError("");
    const created = await onCreateTag(newTag.trim());
    setCreatingTag(false);
    if (!created.ok) {
      setNewTagError(created.error);
      return;
    }
    if (!selectedIds.has(created.value.id)) onChange({ tags: [...data.tags, created.value] });
    setNewTag("");
  }

  function updateLink(index: number, patch: Partial<EventLinkForm>) {
    onChange({ links: data.links.map((link, at) => (at === index ? { ...link, ...patch } : link)) });
  }

  return (
    <div className="column gap-[22px]">
      <fieldset className="column gap-2.5 min-w-0">
        <legend className={LEGEND}>Tags</legend>

        {systemTags.length === 0 ? (
          <p className="text-sm text-fg-2">Nenhuma tag oficial cadastrada ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags oficiais">
            {systemTags.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  aria-pressed={selectedIds.has(tag.id)}
                  onClick={() => toggleTag(tag)}
                  disabled={disabled}
                  className="pill focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={FIELD}>
          <label htmlFor={id("newTag")} className={FIELD_LABEL}>Nova tag livre</label>
          <div className="flex flex-wrap items-start gap-2">
            <input
              {...FieldA11y(id("newTag"), newTagError, freeFormHint)}
              type="text"
              value={newTag}
              disabled={disabled || creatingTag}
              onChange={(event) => { setNewTag(event.target.value); setNewTagError(""); }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void addFreeFormTag();
              }}
              className={`input flex-[1_1_180px] w-auto min-w-0 ${newTagError ? "input-error" : ""}`}
              placeholder="Ex.: robótica"
              maxLength={40}
            />
            <button type="button" onClick={addFreeFormTag} disabled={disabled || creatingTag} className="button min-h-12 shrink-0 grow sm:grow-0">
              <MdAdd aria-hidden className="h-4 w-4" /> {creatingTag ? "Adicionando..." : "Adicionar tag"}
            </button>
          </div>
          <FieldError fieldId={id("newTag")} error={newTagError} />
          <p id={freeFormHint} className={FIELD_HINT}>
            Tags livres ficam ocultas no mural até que um moderador as promova a tags oficiais.
          </p>
        </div>

        {freeFormSelected.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags livres escolhidas">
            {freeFormSelected.map((tag) => (
              <li key={tag.id} className="row gap-0.5 rounded-full border border-dashed border-muted pl-3 text-sm">
                <span><span aria-hidden className="text-fg-3"># </span>{tag.name}</span>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={disabled}
                  aria-label={`Remover a tag ${tag.name}`}
                  className="center h-11 w-11 rounded-full text-fg-2 transition-colors hover:bg-[var(--surface-2)] focus-ring"
                >
                  <MdClose aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="column gap-2.5 min-w-0">
        <legend className={LEGEND}>Links</legend>

        {linkLabels.length === 0 ? (
          <p className="text-sm text-fg-2">
            Nenhum tipo de link cadastrado. Um superadmin precisa criar os tipos (ex.: Inscrição) antes.
          </p>
        ) : (
          <>
            {data.links.length > 0 && (
              <ol className="column gap-2.5">
                {data.links.map((link, index) => {
                  const at = `links.${index}`;
                  const number = index + 1;
                  return (
                    <li key={link.key} className="flex flex-wrap items-start gap-2">
                      <div className={`${FIELD} flex-[1_1_150px]`}>
                        <label htmlFor={id(`${at}.labelId`)} className="sr-only">Tipo do link {number}</label>
                        <span className="relative flex">
                          <select
                            {...FieldA11y(id(`${at}.labelId`), errors[`${at}.labelId`])}
                            value={link.labelId}
                            disabled={disabled}
                            onChange={(event) => updateLink(index, { labelId: event.target.value })}
                            className={`input appearance-none pr-9 ${errors[`${at}.labelId`] ? "input-error" : ""}`}
                          >
                            <option value="">Escolha o tipo...</option>
                            {linkLabels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
                          </select>
                          <svg
                            aria-hidden
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-2"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                        <FieldError fieldId={id(`${at}.labelId`)} error={errors[`${at}.labelId`]} />
                      </div>
                      <div className={`${FIELD} flex-[3_1_220px]`}>
                        <label htmlFor={id(`${at}.url`)} className="sr-only">Endereço do link {number}</label>
                        <input
                          {...FieldA11y(id(`${at}.url`), errors[`${at}.url`])}
                          type="url"
                          inputMode="url"
                          value={link.url}
                          disabled={disabled}
                          onChange={(event) => updateLink(index, { url: event.target.value })}
                          className={`input ${errors[`${at}.url`] ? "input-error" : ""}`}
                          placeholder="https://"
                        />
                        <FieldError fieldId={id(`${at}.url`)} error={errors[`${at}.url`]} />
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange({ links: data.links.filter((_, i) => i !== index) })}
                        disabled={disabled}
                        aria-label={`Remover link ${number}`}
                        className="button ghost icon-only min-h-12 w-12 min-w-12 text-fg-2"
                      >
                        <MdDeleteOutline aria-hidden className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <button type="button" onClick={onAddLink} disabled={disabled} className="button ghost self-start font-semibold text-main">
              <MdAdd aria-hidden className="h-4 w-4" /> Adicionar link
            </button>
          </>
        )}
      </fieldset>

      <fieldset className="column gap-2.5 min-w-0">
        <legend className={LEGEND}>
          Banner <span className="font-normal text-fg-3">(opcional)</span>
        </legend>
        {data.banner === null ? (
          <ImageCropper rules={BANNER_RULES} purpose="banner do evento" disabled={disabled} onCropped={(banner) => onChange({ banner })} />
        ) : (
          <div className="column gap-2.5">
            <BlobPreview picture={data.banner} alt="Prévia do banner do evento" className="aspect-video w-full rounded-[18px] border border-line object-cover" />
            <button type="button" disabled={disabled} onClick={() => onChange({ banner: null })} className="button danger-soft self-start">
              <MdDeleteOutline aria-hidden className="h-4 w-4" /> Remover banner
            </button>
            <p className={FIELD_HINT}>
              O banner é enviado quando o evento for publicado e passa por uma análise automática antes de aparecer para todos.
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );
}
