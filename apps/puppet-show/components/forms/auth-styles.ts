/**
 * Class names shared by the account screens (login, sign-up, e-mail
 * confirmation, forgot and reset password), so the cards look the same.
 *
 * @module
 */

/** Surface and width of an account card, without its spacing. */
export const AUTH_CARD_BASE = "glass-strong column w-full max-w-[440px]";

/** The glass card that holds each account form. */
export const AUTH_CARD = `${AUTH_CARD_BASE} gap-4 rounded-[30px] p-6 sm:p-7`;

/** The card's title (the page's `<h1>`). */
export const AUTH_TITLE = "h1 text-[28px] md:text-[28px] leading-[1.05]";

/** The card's title on the login screen, a little larger. */
export const AUTH_TITLE_LARGE = "h1 text-[30px] md:text-[30px] leading-[1.05]";

/** A label above a field. */
export const AUTH_LABEL = "mb-0 text-[13px] font-medium text-fg-2";

/** A label and its field (and message) stacked. */
export const AUTH_FIELD = "column gap-1.5";

/** A text field. */
export const AUTH_INPUT = "input min-h-[52px]";

/** The message under a field that failed validation. */
export const AUTH_FIELD_ERROR = "text-[12.5px] text-danger";

/** The form's main action. */
export const AUTH_SUBMIT = "button main min-h-[52px] rounded-2xl text-[15px]";

/** The login screen's main action, a little larger. */
export const AUTH_SUBMIT_LARGE = "button main min-h-[54px] rounded-2xl text-base";
