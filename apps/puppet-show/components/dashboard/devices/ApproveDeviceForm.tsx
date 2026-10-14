/**
 * Form to approve a pending device: which totem it is (its identifier), then
 * its name and where it is, both required.
 * When `organizations` is given (Superadmin assigning an orphan device), the
 * organization must be chosen too.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ui/Feedback";
import { DeviceGlyph } from "./device-glyph";
import { ValidateApproval, type Approval, type ApprovalValues, type FieldErrors } from "./deviceForms";

/** What the form submits. */
export type ApprovalSubmission = Approval & { organizationId?: string };

export type ApproveDeviceFormProps = {
  /** Identifier the device sent, shown so the person knows which one they approve. */
  identifier: string;
  /** Organizations to choose from; omit when the device already belongs to one. */
  organizations?: Array<{ id: string; name: string }>;
  saving: boolean;
  /** Why the last attempt failed. */
  error: string;
  onSubmit: (approval: ApprovalSubmission) => void;
  onCancel: () => void;
};

/** The approval form. */
export function ApproveDeviceForm({ identifier, organizations, saving, error, onSubmit, onCancel }: ApproveDeviceFormProps) {
  const [values, setValues] = useState<ApprovalValues>({ name: "", location: "" });
  const [organizationId, setOrganizationId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const validation = ValidateApproval(values);
  const needsOrg = organizations !== undefined && organizationId === "";
  const errors: FieldErrors<keyof ApprovalValues> = submitted && !validation.ok ? validation.error : {};
  const orgError = submitted && needsOrg ? "Escolha a organização." : "";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.ok || needsOrg) return;
    onSubmit(organizations === undefined ? validation.value : { ...validation.value, organizationId });
  };

  /** Props wiring a text input to its label and error. */
  const wire = (field: keyof ApprovalValues) => ({
    id: `approve-${field}`,
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
    "aria-invalid": errors[field] !== undefined,
    ...(errors[field] !== undefined ? { "aria-describedby": `approve-${field}-error` } : {}),
    className: `input ${errors[field] !== undefined ? "input-error" : ""}`,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="column gap-4">
      <div className="well row gap-3.5 rounded-[18px] p-4">
        <span aria-hidden className="c-warn grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--warn-bg)]">
          <DeviceGlyph />
        </span>
        <p className="column min-w-0 leading-snug">
          <span className="font-semibold">Novo totem conectado</span>
          <span className="mono t3 text-[12.5px] break-all">Identificador: {identifier}</span>
        </p>
      </div>

      {organizations !== undefined && (
        <div className="column gap-1">
          <label htmlFor="approve-org">Organização</label>
          <select
            id="approve-org"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            aria-invalid={orgError !== ""}
            aria-describedby={orgError !== "" ? "approve-org-error" : undefined}
            className={`input ${orgError !== "" ? "input-error" : ""}`}
          >
            <option value="" disabled>Escolha...</option>
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
          {orgError !== "" && <p id="approve-org-error" className="error-message">{orgError}</p>}
        </div>
      )}

      <div className="column gap-1">
        <label htmlFor="approve-name">Nome do dispositivo</label>
        <input {...wire("name")} placeholder="Ex.: Totem Biblioteca" />
        {errors.name !== undefined && <p id="approve-name-error" className="error-message">{errors.name}</p>}
      </div>

      <div className="column gap-1">
        <label htmlFor="approve-location">Localização</label>
        <input {...wire("location")} placeholder="Ex.: Biblioteca Central, térreo" />
        {errors.location !== undefined && <p id="approve-location-error" className="error-message">{errors.location}</p>}
      </div>

      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="button ghost focus-ring min-h-12">Cancelar</button>
        <button type="submit" disabled={saving} className="button main focus-ring min-h-12 px-6">
          {saving ? "Aprovando..." : "Aprovar dispositivo"}
        </button>
      </div>
    </form>
  );
}
