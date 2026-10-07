import { AppIO } from '../io/index.ts';

/**
 * Handler signature convention: (request, io) -> response
 * Handlers must be pure functions with no side effects beyond calling `io` methods.
 */
export async function healthCheck(request: Request, io: AppIO) {
  return { status: "ok" };
}
