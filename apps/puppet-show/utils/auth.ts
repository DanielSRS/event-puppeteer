/* utils/auth.ts */

/* SERVER ONLY: READS THE LOGGED USER FROM THE COOKIE */

import { cookies } from "next/headers";
import { TOKEN_COOKIE, VerifyToken } from "@/utils/jwt";

export async function GetSession(): Promise<{ id: string; name: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token)
    return null;

  const payload = await VerifyToken(token);

  if (!payload?.id)
    return null;

  return { id: String(payload.id), name: String(payload.name ?? "") };
};

export async function GetUserId(): Promise<string | null> {
  return (await GetSession())?.id ?? null;
};
