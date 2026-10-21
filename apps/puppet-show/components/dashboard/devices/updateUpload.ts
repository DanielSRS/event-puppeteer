/**
 * Sending a Puppet binary from the browser: SHA-256 of the file, upload straight to the
 * private store with the credential Puppeteer authorized, then the `update` command that
 * points at the upload. Nothing here throws; every step answers a {@link Result}.
 *
 * @module
 */

import { put } from "@vercel/blob/client";
import { api, ApiErrorMessage } from "@/lib/api/client";
import type { IssuedCommand, UpdateUploadGrant } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";

/** The step an upload is in, for the progress line of the form. */
export type UpdateUploadStep =
  | { step: "hashing" }
  | { step: "authorizing" }
  | { step: "uploading"; percentage: number }
  | { step: "sending" };

/** Text of a step. */
export function UpdateStepText(step: UpdateUploadStep): string {
  switch (step.step) {
    case "hashing": return "Calculando o SHA-256 do arquivo...";
    case "authorizing": return "Pedindo autorização de envio...";
    case "uploading": return `Enviando o arquivo... ${Math.round(step.percentage)}%`;
    case "sending": return "Enviando o comando ao dispositivo...";
  }
}

/** The SHA-256 of `file` as 64 lowercase hexadecimal characters. */
export async function Sha256Hex(file: Blob): Promise<Result<string, string>> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Ok(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
  } catch (cause) {
    return Err(cause instanceof Error ? cause.message : String(cause));
  }
}

/** Uploads `file` to the store under the grant; resolves to the reason when the store refuses. */
async function UploadToStore(grant: UpdateUploadGrant, file: File, onProgress: (percentage: number) => void): Promise<Result<null, string>> {
  try {
    await put(grant.pathname, file, {
      access: "private",
      token: grant.clientToken,
      contentType: grant.contentType,
      multipart: true,
      onUploadProgress: (event) => onProgress(event.percentage),
    });
    return Ok(null);
  } catch (cause) {
    return Err(cause instanceof Error ? cause.message : String(cause));
  }
}

/**
 * Uploads `file` and sends the `update` command of device `deviceId`.
 *
 * @param onStep - Called as each step starts (and while the upload advances).
 * @returns The command with the outcome of its Wake-up, or the text to show the person.
 */
export async function SendUpdateFile(
  orgId: string,
  deviceId: string,
  file: File,
  version: string | undefined,
  onStep: (step: UpdateUploadStep) => void,
): Promise<Result<IssuedCommand, string>> {
  onStep({ step: "hashing" });
  const sha256 = await Sha256Hex(file);
  if (!sha256.ok) return Err(`Não foi possível calcular o SHA-256 do arquivo. ${sha256.error}`);

  onStep({ step: "authorizing" });
  const grant = await api.devices.requestUpdateUpload(orgId, file.size);
  if (!grant.ok) return Err(`Não foi possível autorizar o envio do arquivo. ${ApiErrorMessage(grant.error)}`);

  onStep({ step: "uploading", percentage: 0 });
  const uploaded = await UploadToStore(grant.value, file, (percentage) => onStep({ step: "uploading", percentage }));
  if (!uploaded.ok) return Err(`O armazenamento recusou o arquivo. ${uploaded.error}`);

  onStep({ step: "sending" });
  const payload = { blobPathname: grant.value.pathname, sha256: sha256.value, ...(version !== undefined ? { version } : {}) };
  const sent = await api.devices.sendCommand(orgId, deviceId, { type: "update", payload });
  if (!sent.ok) return Err(`O arquivo foi enviado, mas o comando não. ${ApiErrorMessage(sent.error)}`);
  return Ok(sent.value);
}
