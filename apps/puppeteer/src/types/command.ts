import { t, type Static } from 'elysia';

export const CommandTypeSchema = t.Union([
  t.Literal('restart'),
  t.Literal('shutdown'),
  t.Literal('update'),
  t.Literal('open_ssh'),
  t.Literal('custom'),
  t.Literal('request_telemetry')
]);
export type CommandType = Static<typeof CommandTypeSchema>;

export const CommandStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('sent'),
  t.Literal('acknowledged'),
  t.Literal('completed'),
  t.Literal('failed')
]);
export type CommandStatus = Static<typeof CommandStatusSchema>;

export const CommandSchema = t.Object({
  id: t.String(),
  deviceId: t.String(),
  type: CommandTypeSchema,
  payload: t.Optional(t.Record(t.String(), t.Unknown())),
  status: CommandStatusSchema,
  issuedBy: t.String(),
  issuedAt: t.String({ format: 'date-time' }),
  completedAt: t.Optional(t.String({ format: 'date-time' }))
});
export type Command = Static<typeof CommandSchema>;

const Sha256Schema = t.String({ pattern: '^[0-9a-fA-F]{64}$', description: 'SHA-256 of the binary, 64 hex characters' });
const VersionSchema = t.Optional(t.String({ description: 'Informational; shows up in device logs' }));

/** Contract implemented by Puppet: download, verify digest and architecture, install, re-exec. This is what a Device receives. */
export const DeviceUpdatePayloadSchema = t.Object({
  url: t.String({
    pattern: '^(https?://|/)',
    description: 'Absolute http(s) URL, or a path on Puppeteer starting with "/" (only then does Puppet send its device token)'
  }),
  sha256: Sha256Schema,
  version: VersionSchema
});

/** An update whose binary was uploaded through `update-uploads`: Puppeteer signs a fresh download URL each time a Device pulls it. */
export const StoredUpdatePayloadSchema = t.Object({
  blobPathname: t.String({ description: 'The `pathname` answered by `update-uploads`, inside the sender\'s Organization' }),
  sha256: Sha256Schema,
  version: VersionSchema
});

/** An update Command is sent either with a URL to download from or with an uploaded binary. */
export const UpdatePayloadSchema = t.Union([DeviceUpdatePayloadSchema, StoredUpdatePayloadSchema]);
export type UpdatePayload = Static<typeof UpdatePayloadSchema>;
export type StoredUpdatePayload = Static<typeof StoredUpdatePayloadSchema>;

/** Where uploaded update binaries live inside the store, per Organization. */
export function UpdateBinaryPrefix(orgId: string): string {
  return `puppet-updates/${orgId}/`;
}

export const CreateCommandBody = t.Union([
  t.Object({ type: t.Literal('update'), payload: UpdatePayloadSchema }),
  t.Object({
    type: t.Union([
      t.Literal('restart'),
      t.Literal('shutdown'),
      t.Literal('open_ssh'),
      t.Literal('custom'),
      t.Literal('request_telemetry')
    ]),
    payload: t.Optional(t.Record(t.String(), t.Unknown()))
  })
]);
export type CreateCommandInput = Static<typeof CreateCommandBody>;

/** Content type every update binary is uploaded with. */
export const UPDATE_BINARY_CONTENT_TYPE = 'application/octet-stream';

/** Largest binary Puppet accepts (HTTP_DOWNLOAD_MAX_BYTES in the Puppet source): 64 MiB. */
export const UPDATE_BINARY_MAX_BYTES = 64 * 1024 * 1024;

export const RequestUpdateUploadBody = t.Object({
  sizeBytes: t.Integer({
    minimum: 1,
    maximum: UPDATE_BINARY_MAX_BYTES,
    description: 'Size of the binary about to be uploaded; Puppet refuses anything over 64 MiB'
  })
});
export type RequestUpdateUploadInput = Static<typeof RequestUpdateUploadBody>;

export const UpdateUploadGrantSchema = t.Object({
  pathname: t.String({ description: 'Name the upload must use in the store' }),
  clientToken: t.String({ description: 'Credential for exactly one upload to `pathname`' }),
  contentType: t.String({ description: 'Content type the upload must declare' }),
  maxBytes: t.Integer({ description: 'Largest size the credential allows' })
});
export type UpdateUploadGrantView = Static<typeof UpdateUploadGrantSchema>;

/** Path on Puppeteer where a Device downloads the binary of its update Command; short because Puppet keeps the address in 512 bytes. */
export function UpdateBinaryDownloadPath(deviceId: string, commandId: string): string {
  return `/devices/${deviceId}/commands/${commandId}/binary`;
}
