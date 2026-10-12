/**
 * Step 3 of the event editor: tags, external links and the banner, picked and
 * cropped to 16:9 here and uploaded once the event is published.
 *
 * System-defined tags are toggle chips. A free-form tag is created by name
 * (any logged-in person may suggest one); it is attached to the event but
 * stays hidden on the public pages until a moderator promotes it.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdAdd, MdClose, MdDelete } from "react-icons/md";
import { BlobPreview } from "@/components/ui/BlobPreview";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { BANNER_RULES } from "@/utils/crop";
import type { LinkLabel, Tag } from "@/lib/api/schemas";
import type { Result } from "@/lib/result";
import {
  ValidateNewTag, type EventFormData, type EventFormErrors, type EventLinkForm,
} from "@/utils/validation/EventValidation";
import { FieldA11y, FieldError, FieldId } from "./EventFormField";

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
    <div className="column gap-6">
      <fieldset className="column gap-3 min-w-0">
        <legend className="mb-2 text-sm font-semibold">Tags</legend>

        {systemTags.length === 0 ? (
          <p className="text-sm text-foreground/80">Nenhuma tag oficial cadastrada ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Tags oficiais">
            {systemTags.map((tag) => {
              const selected = selectedIds.has(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag)}
                    disabled={disabled}
                    className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${
                      selected ? "border-main bg-main text-background font-semibold" : "border-muted hover:border-main"
                    }`}
                  >
                    {tag.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {freeFormSelected.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Tags livres escolhidas">
            {freeFormSelected.map((tag) => (
              <li key={tag.id} className="row gap-1 rounded-full border border-muted pl-4 text-sm">
                <span>{tag.name}</span>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={disabled}
                  aria-label={`Remover a tag ${tag.name}`}
                  className="center h-10 w-10 rounded-full hover:bg-white/10"
                >
                  <MdClose aria-hidden className="icon" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="column">
          <label htmlFor={id("newTag")}>Nova tag livre</label>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              className={`input ${newTagError ? "input-error" : ""}`}
              placeholder="Ex.: robótica"
              maxLength={40}
            />
            <button type="button" onClick={addFreeFormTag} disabled={disabled || creatingTag} className="button clean min-h-10 shrink-0">
              <MdAdd aria-hidden className="icon" /> {creatingTag ? "Adicionando..." : "Adicionar tag"}
            </button>
          </div>
          <FieldError fieldId={id("newTag")} error={newTagError} />
          <p id={freeFormHint} className="mt-1 text-sm text-foreground/80">
            Tags livres ficam ocultas no mural até que um moderador as promova a tags oficiais.
          </p>
        </div>
      </fieldset>

      <fieldset className="column gap-3 min-w-0">
        <legend className="mb-2 text-sm font-semibold">Links</legend>

        {linkLabels.length === 0 ? (
          <p className="text-sm text-foreground/80">
            Nenhum tipo de link cadastrado. Um superadmin precisa criar os tipos (ex.: Inscrição) antes.
          </p>
        ) : (
          <>
            {data.links.length > 0 && (
              <ol className="column gap-3">
                {data.links.map((link, index) => {
                  const at = `links.${index}`;
                  const number = index + 1;
                  return (
                    <li key={link.key} className="grid grid-cols-1 gap-3 rounded-xl border border-muted p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
                      <div className="column min-w-0">
                        <label htmlFor={id(`${at}.labelId`)}>Tipo do link {number}</label>
                        <select
                          {...FieldA11y(id(`${at}.labelId`), errors[`${at}.labelId`])}
                          value={link.labelId}
                          disabled={disabled}
                          onChange={(event) => updateLink(index, { labelId: event.target.value })}
                          className={`input min-h-10 ${errors[`${at}.labelId`] ? "input-error" : ""}`}
                        >
                          <option value="">Escolha...</option>
                          {linkLabels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
                        </select>
                        <FieldError fieldId={id(`${at}.labelId`)} error={errors[`${at}.labelId`]} />
                      </div>
                      <div className="column min-w-0">
                        <label htmlFor={id(`${at}.url`)}>Endereço do link {number}</label>
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
                        className="button clean min-h-10 text-danger sm:mt-6"
                      >
                        <MdDelete aria-hidden className="icon" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <button type="button" onClick={onAddLink} disabled={disabled} className="button clean self-start min-h-10">
              <MdAdd aria-hidden className="icon" /> Adicionar link
            </button>
          </>
        )}
      </fieldset>

      <fieldset className="column gap-3 min-w-0">
        <legend className="mb-2 text-sm font-semibold">Banner (opcional)</legend>
        {data.banner === null ? (
          <ImageCropper rules={BANNER_RULES} purpose="banner do evento" disabled={disabled} onCropped={(banner) => onChange({ banner })} />
        ) : (
          <div className="column gap-2">
            <BlobPreview picture={data.banner} alt="Prévia do banner do evento" className="aspect-video w-full rounded-lg border border-muted object-cover" />
            <p className="text-sm text-foreground/80">
              O banner é enviado quando o evento for publicado e passa por uma análise automática antes de aparecer para todos.
            </p>
            <button type="button" disabled={disabled} onClick={() => onChange({ banner: null })} className="button clean self-start min-h-10">
              <MdDelete aria-hidden className="icon" /> Remover banner
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}
