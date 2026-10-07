/* utils/jwt.ts */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const TOKEN_DAYS = 7;

function secret() {
  const value = process.env.JWT_SECRET;

  if (!value)
    throw new Error("JWT_SECRET não configurado no .env.");

  return new TextEncoder().encode(value);
};

export type TokenPayload = JWTPayload & {
  id: string;
  name: string;
};

export async function CreateToken(payload: { id: string; name: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_DAYS}d`)
    .sign(secret());
};

export async function VerifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as TokenPayload;
  }

  catch {
    return null;
  };
};

export const TOKEN_COOKIE = "token";
export const TOKEN_MAX_AGE = TOKEN_DAYS * 24 * 60 * 60;
