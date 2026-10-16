import { issueSignedToken, presignUrl } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import type { UpdateBinaryStore, UpdateBinaryStoreFailure, UpdateUploadGrant } from '../index.ts';
import { UPDATE_BINARY_CONTENT_TYPE } from '../../types/command.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/** How long an upload grant works, in milliseconds. */
const GRANT_LIFETIME_MS = 15 * 60 * 1000;

/**
 * Stores update binaries in Vercel Blob (https://vercel.com/docs/vercel-blob/client-upload).
 *
 * The store is private: a binary is only readable through a signed URL that expires, which
 * Puppeteer hands to the Device when it pulls the Command (Puppet downloads with a plain GET).
 * The SHA-256 in the Command still decides whether the Device installs it. A grant is a client token limited to one
 * pathname, one content type, a size and a quarter of an hour, and it never overwrites.
 */
export class VercelBlobUpdateBinaryStore implements UpdateBinaryStore {
  constructor(private readWriteToken: string) {}

  async issueUploadGrant(pathname: string, maxBytes: number): Promise<Result<UpdateUploadGrant, UpdateBinaryStoreFailure>> {
    try {
      const clientToken = await generateClientTokenFromReadWriteToken({
        token: this.readWriteToken,
        pathname,
        allowedContentTypes: [UPDATE_BINARY_CONTENT_TYPE],
        maximumSizeInBytes: maxBytes,
        validUntil: Date.now() + GRANT_LIFETIME_MS,
        addRandomSuffix: false,
        allowOverwrite: false
      });
      return ok({ pathname, clientToken });
    } catch (error) {
      return err(`Vercel Blob refused the grant: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async signedDownloadUrl(pathname: string, validUntil: number): Promise<Result<string, UpdateBinaryStoreFailure>> {
    try {
      const signed = await issueSignedToken({ token: this.readWriteToken, pathname, operations: ['get'], validUntil });
      const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname, access: 'private', validUntil });
      return ok(presignedUrl);
    } catch (error) {
      return err(`Vercel Blob refused to sign the download: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
