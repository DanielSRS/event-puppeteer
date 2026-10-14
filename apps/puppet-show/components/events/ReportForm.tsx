/**
 * Form to report an event to the moderators: the reasons as selectable tiles
 * (the picked one turns red), an optional comment, the rule about automatic
 * hiding, and the actions.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import { MdPolicy } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import type { ReportReason } from "@/lib/api/schemas";

/** What the form sends. */
export type ReportFormData = {
  reason: ReportReason;
  comment?: string;
};

export type ReportFormProps = {
  /** Reports from different people that hide the event automatically; `null` while unknown. */
  threshold: number | null;
  isSending: boolean;
  /** Why the last attempt failed. */
  error?: string;
  onSubmit: (data: ReportFormData) => void;
  onCancel: () => void;
};

/** Reasons the API accepts, with their Portuguese labels. */
const REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "offensive_content", label: "Conteúdo ofensivo" },
  { value: "incorrect_information", label: "Informação incorreta" },
  { value: "duplicate", label: "Evento duplicado" },
];

/** Comments longer than this are refused by the form. */
const MAX_COMMENT = 500;

/** Pick a reason, optionally explain; explains what happens when enough people report. */
export function ReportForm({ threshold, isSending, error = "", onSubmit, onCancel }: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const commentId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reason === null) return;
    const trimmed = comment.trim();
    onSubmit(trimmed === "" ? { reason } : { reason, comment: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className="column gap-[18px]">
      <fieldset className="column m-0 gap-2 border-0 p-0">
        <legend className="mb-2.5 p-0 text-sm font-semibold">Motivo da denúncia</legend>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
          {REASONS.map((option) => (
            <label
              key={option.value}
              className="surface row mb-0 min-h-[52px] cursor-pointer gap-2.5 rounded-2xl border border-[var(--line-2)] px-3.5 text-[15px] text-foreground transition-colors has-[:checked]:border-[var(--bad)] has-[:checked]:bg-[var(--bad-bg)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-main"
            >
              <input
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="h-[18px] w-[18px] shrink-0 accent-[var(--danger-fill)] outline-none"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="column gap-1.5">
        <label htmlFor={commentId} className="mb-0 text-sm font-semibold text-foreground">
          Comentário{" "}<span className="t3 font-normal">(opcional)</span>
        </label>
        <textarea
          id={commentId}
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Conte à moderação o que está errado."
          className="input resize-y py-3"
        />
      </div>

      <p className="notice n-info">
        <MdPolicy aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
        Cada pessoa pode denunciar um evento uma vez.{" "}
        {threshold === null
          ? "Quando um evento recebe denúncias de várias pessoas diferentes, ele é ocultado automaticamente até a moderação revisar."
          : `Ao chegar a ${threshold} ${threshold === 1 ? "denúncia" : "denúncias"} de pessoas diferentes, o evento é ocultado automaticamente e o autor fica restrito até a moderação revisar.`}
      </p>

      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSending} className="button focus-ring min-h-12 px-5">
          Cancelar
        </button>
        <button type="submit" disabled={reason === null || isSending} className="button danger focus-ring min-h-12 px-[22px]">
          {isSending ? "Enviando..." : "Enviar denúncia"}
        </button>
      </div>
    </form>
  );
}
