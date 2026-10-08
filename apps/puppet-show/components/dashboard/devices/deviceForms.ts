/**
 * Validation of the device forms: approving a device (name and location) and
 * the "update Puppet" command (where to download the binary and its SHA-256).
 *
 * @module
 */

import { Err, Ok, type Result } from "@/lib/result";

/** Problems per field (absent = fine). */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** The approval form as typed. */
export type ApprovalValues = { name: string; location: string };

/** Body of the approval (trimmed). */
export type Approval = { name: string; location: string };

/** Name and location are both required. */
export function ValidateApproval(values: ApprovalValues): Result<Approval, FieldErrors<keyof ApprovalValues>> {
  const name = values.name.trim();
  const location = values.location.trim();
  const errors: FieldErrors<keyof ApprovalValues> = {};
  if (name === "") errors.name = "Informe o nome do dispositivo.";
  if (location === "") errors.location = "Informe onde o dispositivo está.";
  return Object.keys(errors).length > 0 ? Err(errors) : Ok({ name, location });
}

/** The update form as typed. */
export type UpdateValues = { url: string; sha256: string; version: string };

/** Payload of the `update` command. */
export type UpdatePayload = { url: string; sha256: string; version?: string };

/**
 * Whether `text` is where Puppet can download the binary: an absolute http(s)
 * URL, or a path on Puppeteer starting with a single "/".
 */
export function IsUpdateUrl(text: string): boolean {
  if (text.startsWith("/")) return !text.startsWith("//") && !/\s/.test(text);
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    return new URL(text).hostname !== "";
  } catch {
    return false;
  }
}

/** 64 hexadecimal characters. */
const SHA256_PATTERN = /^[0-9a-fA-F]{64}$/;

/** URL and SHA-256 are required; the version is optional and informational. */
export function ValidateUpdate(values: UpdateValues): Result<UpdatePayload, FieldErrors<keyof UpdateValues>> {
  const url = values.url.trim();
  const sha256 = values.sha256.trim();
  const version = values.version.trim();
  const errors: FieldErrors<keyof UpdateValues> = {};

  if (url === "") errors.url = "Informe de onde baixar o Puppet.";
  else if (!IsUpdateUrl(url)) errors.url = "Use um endereço completo (http:// ou https://) ou um caminho no Puppeteer começando com “/”.";

  if (sha256 === "") errors.sha256 = "Informe o SHA-256 do arquivo.";
  else if (!SHA256_PATTERN.test(sha256)) errors.sha256 = `O SHA-256 tem 64 caracteres hexadecimais (0-9, a-f); este tem ${sha256.length}.`;

  if (Object.keys(errors).length > 0) return Err(errors);
  return Ok(version === "" ? { url, sha256 } : { url, sha256, version });
}
