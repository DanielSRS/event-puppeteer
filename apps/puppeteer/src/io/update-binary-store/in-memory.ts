import type { UpdateBinaryStore, UpdateBinaryStoreFailure, UpdateUploadGrant } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Test double: records the grants it issues so tests can inspect exactly what a browser
 * would be allowed to upload. Never wired in production.
 */
export class InMemoryUpdateBinaryStore implements UpdateBinaryStore {
  /** Every grant issued, with the size limit it carried. */
  grants: Array<UpdateUploadGrant & { maxBytes: number }> = [];
  /** When set, issuing fails with this reason. */
  failure: UpdateBinaryStoreFailure | null = null;
  /** Every download URL signed, with the expiry it carried. */
  signed: Array<{ pathname: string; validUntil: number }> = [];

  async issueUploadGrant(pathname: string, maxBytes: number): Promise<Result<UpdateUploadGrant, UpdateBinaryStoreFailure>> {
    if (this.failure !== null) return err(this.failure);
    const grant = { pathname, clientToken: `memory-token-${this.grants.length + 1}` };
    this.grants.push({ ...grant, maxBytes });
    return ok(grant);
  }

  async signedDownloadUrl(pathname: string, validUntil: number): Promise<Result<string, UpdateBinaryStoreFailure>> {
    if (this.failure !== null) return err(this.failure);
    this.signed.push({ pathname, validUntil });
    return ok(`memory://signed/${pathname}?valid-until=${validUntil}`);
  }
}
