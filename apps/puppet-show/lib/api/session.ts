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

/* ANONYMOUS VISITORS STILL NEED AN ORGANIZATION TO SEE ITS FEED (WHITE-LABEL DEFAULT) */
export const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? "default-org";
