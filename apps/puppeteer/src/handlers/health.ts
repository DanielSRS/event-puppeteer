import { IO } from '../io/index.ts';

/**
 * Handler signature convention: (request, io) -> response
 * Handlers must be pure functions with no side effects beyond calling `io` methods.
 */
export async function healthCheck(request: Request | null, io: IO) {
  const isOk = await io.ping();
  return { status: isOk ? "ok" : "error" };
}
