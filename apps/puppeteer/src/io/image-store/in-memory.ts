import type { ImageStore, ImageStoreFailure } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Test double: keeps the bytes in memory so tests can inspect exactly what would be
 * stored. URLs use the `memory:` scheme. Never wired in production.
 */
export class InMemoryImageStore implements ImageStore {
  /** Stored WebP bytes by Image id. */
  assets = new Map<string, Uint8Array<ArrayBuffer>>();
  /** When set, storing fails with this reason. */
  failure: ImageStoreFailure | null = null;

  async storeRestricted(id: string, webp: Uint8Array<ArrayBuffer>): Promise<Result<void, ImageStoreFailure>> {
    if (this.failure !== null) return err(this.failure);
    this.assets.set(id, webp);
    return ok(undefined);
  }

  publicUrl(id: string): string {
    return `memory://public/${id}.webp`;
  }

  signedUrl(id: string): string {
    return `memory://signed/${id}.webp`;
  }
}
