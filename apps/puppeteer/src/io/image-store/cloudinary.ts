import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ImageStore, ImageStoreFailure } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/** How long a signed URL works, in seconds. */
const SIGNED_URL_LIFETIME = 60 * 60;

const failureSchema = z.object({ error: z.object({ message: z.string() }) });

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Stores Images in Cloudinary (https://cloudinary.com/documentation).
 *
 * Every asset is uploaded with the `authenticated` delivery type: Cloudinary serves it only
 * through a URL signed with the API secret, so knowing an Image's id is not enough to see it.
 * Assets never change type, so the URLs an uploader receives look the same whatever their
 * Image's state.
 * - `publicUrl` is a signed delivery URL: permanent and cached by the CDN.
 * - `signedUrl` is a private download URL that expires after an hour. It bypasses the CDN
 *   (Cloudinary bills it twice), which is fine for uploaders and reviewers only.
 */
export class CloudinaryImageStore implements ImageStore {
  constructor(
    private credentials: CloudinaryCredentials,
    private fetchImpl: typeof fetch = fetch,
    private now: () => Date = () => new Date()
  ) {}

  async storeRestricted(id: string, webp: Uint8Array<ArrayBuffer>): Promise<Result<void, ImageStoreFailure>> {
    const params = { overwrite: 'false', public_id: id, timestamp: String(this.unixNow()), type: 'authenticated' };
    const form = new FormData();
    form.set('file', new Blob([webp], { type: 'image/webp' }), `${id}.webp`);
    for (const [name, value] of Object.entries(params)) form.set(name, value);
    form.set('api_key', this.credentials.apiKey);
    form.set('signature', this.sign(params));

    let response: Response;
    let body: unknown;
    try {
      response = await this.fetchImpl(`https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/image/upload`, { method: 'POST', body: form });
      body = await response.json();
    } catch (error) {
      return err(`Cloudinary unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
      const failure = failureSchema.safeParse(body);
      return err(`Cloudinary answered ${response.status}: ${failure.success ? failure.data.error.message : 'unexpected answer'}`);
    }
    return ok(undefined);
  }

  publicUrl(id: string): string {
    const path = `${id}.webp`;
    const signature = createHash('sha1').update(path + this.credentials.apiSecret).digest('base64url').slice(0, 8);
    return `https://res.cloudinary.com/${this.credentials.cloudName}/image/authenticated/s--${signature}--/${path}`;
  }

  signedUrl(id: string): string {
    const timestamp = this.unixNow();
    const params = {
      expires_at: String(timestamp + SIGNED_URL_LIFETIME),
      format: 'webp',
      public_id: id,
      timestamp: String(timestamp),
      type: 'authenticated'
    };
    const query = new URLSearchParams({ ...params, api_key: this.credentials.apiKey, signature: this.sign(params) });
    return `https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/image/download?${query}`;
  }

  /** Cloudinary's API signature: the parameters sorted and joined, the secret appended, SHA-1 in hex. */
  private sign(params: Record<string, string>): string {
    const joined = Object.keys(params).sort().map(name => `${name}=${params[name]}`).join('&');
    return createHash('sha1').update(joined + this.credentials.apiSecret).digest('hex');
  }

  private unixNow(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
}
