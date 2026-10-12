// Test-only helpers. Not imported by application code.
import sharp from 'sharp';
import type { InMemoryIO } from './io/in-memory.ts';
import type { RegisterInput } from './types/user.ts';
import { registerHandler, verifyEmailHandler, loginHandler } from './handlers/auth.ts';

type TestIO = InMemoryIO;

// Token from the latest verification email sent to this address
export function verificationTokenFor(io: TestIO, email: string) {
  const message = io.emailSender.sent.findLast(m => m.to.email === email);
  const token = message?.text.match(/[?&]token=([^&\s]+)/)?.[1];
  if (!token) throw new Error(`No verification email sent to ${email}`);
  return decodeURIComponent(token);
}

// Registers through the real flow (email link opened, then login) and returns a session token
export async function registerVerified(body: RegisterInput, orgId: string, io: TestIO) {
  const { user } = await registerHandler(body, orgId, io);
  await verifyEmailHandler(verificationTokenFor(io, body.email), io);
  const { token } = await loginHandler({ email: body.email, password: body.password }, io);
  return { user, token };
}

/**
 * A real picture file of the given size: a PNG with a colour gradient (so the thumbhash
 * has something to describe). `orientation` writes an EXIF orientation tag and `gps`
 * writes a GPS position, as a phone camera would.
 */
export async function pictureFile(width: number, height: number, options: { format?: 'png' | 'jpeg'; orientation?: number; gps?: boolean } = {}) {
  const format = options.format ?? 'png';
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      pixels[i] = Math.round((x / width) * 255);
      pixels[i + 1] = Math.round((y / height) * 255);
      pixels[i + 2] = 128;
    }
  }
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (options.gps) {
    image = image.withExif({ IFD0: { Make: 'PhoneMaker' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '12/1 15/1 0/1' } });
  }
  // The orientation tag is written by withMetadata: withExif leaves it out
  if (options.orientation !== undefined) image = image.withMetadata({ orientation: options.orientation });
  const bytes = await (format === 'png' ? image.png() : image.jpeg()).toBuffer();
  return new File([bytes], `picture.${format}`, { type: `image/${format}` });
}
