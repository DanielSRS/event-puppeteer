/* lib/api/session.ts */

/* PUPPETEER ANSWERS LOGIN WITH A BEARER TOKEN, SO THE BROWSER KEEPS IT AND SENDS IT ON EVERY CALL */

const TOKEN_KEY = "puppet-show:token";

export function GetToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  catch {
    return null;
  };
};

export function SetToken(token: string | null) {
  try {
    if (token)
      window.localStorage.setItem(TOKEN_KEY, token);
    else
      window.localStorage.removeItem(TOKEN_KEY);
  }

  catch {
    /* PRIVATE MODE OR BLOCKED STORAGE: THE SESSION SIMPLY WON'T SURVIVE A RELOAD */
  };
};

/* THE ORGANIZATION ANONYMOUS VISITORS SEE AND SIGN UP INTO (WHITE-LABEL). NO FALLBACK:
   THE DATABASE STARTS WITHOUT ORGANIZATIONS, SO A MISSING VALUE MUST SHOW UP, NOT POINT AT NOTHING */
export const PUBLIC_ORG_ID: string | null = process.env.NEXT_PUBLIC_ORG_ID || null;

export const MISSING_ORG_MESSAGE = "Organização não configurada. Defina NEXT_PUBLIC_ORG_ID com o id de uma organização existente.";
