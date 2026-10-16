/**
 * Validation of the device forms: approving a device (name and location) and
 * the "update Puppet" command (where to download the binary, or the file itself, and its SHA-256).
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

/** Where the new Puppet comes from: an address the device downloads from, or a file sent from this page. */
export type UpdateSource = "url" | "file";

/** The update form as typed. `file` only counts when `source` is `"file"`; `url` and `sha256` only when it is `"url"`. */
export type UpdateValues = { source: UpdateSource; url: string; sha256: string; version: string; file: File | null };

/** Payload of the `update` command when the device downloads from an address. */
export type UpdatePayload = { url: string; sha256: string; version?: string };

/** What the update form asks for, once valid. */
export type UpdateRequest =
  | { kind: "url"; payload: UpdatePayload }
  | { kind: "file"; file: File; version?: string };

/** Largest binary Puppet accepts (64 MiB); Puppeteer refuses to authorize more. */
export const UPDATE_BINARY_MAX_BYTES = 64 * 1024 * 1024;

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

/**
 * From an address: URL and SHA-256 are required. From a file: the file is required, non-empty
 * and at most 64 MiB (its SHA-256 is computed from it). The version is optional and informational.
 */
export function ValidateUpdate(values: UpdateValues): Result<UpdateRequest, FieldErrors<"url" | "sha256" | "file">> {
  const version = values.version.trim();
  const errors: FieldErrors<"url" | "sha256" | "file"> = {};

  if (values.source === "file") {
    if (values.file === null) errors.file = "Escolha o arquivo do Puppet.";
    else if (values.file.size === 0) errors.file = "O arquivo está vazio.";
    else if (values.file.size > UPDATE_BINARY_MAX_BYTES) errors.file = "O arquivo passa de 64 MB, o máximo que o Puppet aceita.";
    if (Object.keys(errors).length > 0 || values.file === null) return Err(errors);
    return Ok(version === "" ? { kind: "file", file: values.file } : { kind: "file", file: values.file, version });
  }

  const url = values.url.trim();
  const sha256 = values.sha256.trim();

  if (url === "") errors.url = "Informe de onde baixar o Puppet.";
  else if (!IsUpdateUrl(url)) errors.url = "Use um endereço completo (http:// ou https://) ou um caminho no Puppeteer começando com “/”.";

  if (sha256 === "") errors.sha256 = "Informe o SHA-256 do arquivo.";
  else if (!SHA256_PATTERN.test(sha256)) errors.sha256 = `O SHA-256 tem 64 caracteres hexadecimais (0-9, a-f); este tem ${sha256.length}.`;

  if (Object.keys(errors).length > 0) return Err(errors);
  return Ok({ kind: "url", payload: version === "" ? { url, sha256 } : { url, sha256, version } });
}
