/**
 * Form to report an event to the moderators.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
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
    <form onSubmit={handleSubmit} className="column gap-4">
      <p className="text-sm text-foreground/80">
        Cada pessoa pode denunciar um evento uma vez.{" "}
        {threshold === null
          ? "Quando um evento recebe denúncias de várias pessoas diferentes, ele é ocultado automaticamente até a moderação revisar."
          : `Ao chegar a ${threshold} ${threshold === 1 ? "denúncia" : "denúncias"} de pessoas diferentes, o evento é ocultado automaticamente e o autor fica restrito até a moderação revisar.`}
      </p>

      <fieldset className="column gap-2">
        <legend className="text-sm font-medium mb-2">Motivo da denúncia</legend>
        {REASONS.map((option) => (
          <label key={option.value} className="row gap-2 text-sm opacity-100 mb-0 min-h-10 cursor-pointer">
            <input
              type="radio"
              name="reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              className="h-4 w-4 accent-main"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className="column">
        <label htmlFor={commentId}>Comentário (opcional)</label>
        <textarea
          id={commentId}
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="input"
        />
      </div>

      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSending} className="button clean touch">
          Cancelar
        </button>
        <button type="submit" disabled={reason === null || isSending} className="button danger touch">
          {isSending ? "Enviando..." : "Enviar denúncia"}
        </button>
      </div>
    </form>
  );
}
