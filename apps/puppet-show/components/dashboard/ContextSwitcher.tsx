/**
 * Shows which context the dashboard is managing and, for a Superadmin, lets
 * them switch between the global context and any organization.
 *
 * A disclosure: a button (`aria-expanded`, `aria-controls`) opens a list of
 * options; the current one is marked with `aria-current`. Escape or a click
 * outside closes it and Escape returns focus to the button (without also
 * closing a menu panel the switcher sits in). Works the same
 * with a mouse, a keyboard or a touch screen. Everyone else just sees their
 * own organization's name.
 *
 * @module
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MdCheck, MdDomain, MdExpandMore, MdPublic } from "react-icons/md";

/** An organization the person can manage. */
export type ContextOrganization = { id: string; name: string };

/** Props of {@link ContextSwitcher}. */
export type ContextSwitcherProps = {
  /** Organizations offered (a Superadmin gets all of them; others only their own). */
  organizations: ContextOrganization[];
  /** Organization being managed; `null` = global context. */
  currentOrgId: string | null;
  /** Name of the current context, as shown in the dashboard header. */
  contextName: string;
  /** Only a Superadmin may switch. */
  canSwitch: boolean;
  /** Called with the picked organization id, or `null` for the global context. */
  onSelect: (orgId: string | null) => void;
};

/** The current context, and the switcher for Superadmins. */
export function ContextSwitcher({ organizations, currentOrgId, contextName, canSwitch, onSelect }: ContextSwitcherProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const icon = currentOrgId === null
    ? <MdPublic aria-hidden className="icon" />
    : <MdDomain aria-hidden className="icon" />;

  if (!canSwitch) {
    return (
      <div className="row gap-3 rounded-lg p-2">
        <span className="center h-10 w-10 shrink-0 rounded-lg bg-main text-background">{icon}</span>
        <span className="column min-w-0">
          <span className="text-xs text-foreground/80">Sua organização</span>
          <span className="truncate text-sm font-semibold">{contextName}</span>
        </span>
      </div>
    );
  }

  function pick(orgId: string | null) {
    setOpen(false);
    buttonRef.current?.focus();
    if (orgId !== currentOrgId) onSelect(orgId);
  }

  const options: Array<{ id: string | null; name: string }> = [
    { id: null, name: "Sistema Global" },
    ...organizations.map((org) => ({ id: org.id, name: org.name })),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="row w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
      >
        <span className="center h-10 w-10 shrink-0 rounded-lg bg-main text-background">{icon}</span>
        <span className="column min-w-0 flex-1">
          <span className="text-xs text-foreground/80">Contexto (trocar)</span>
          <span className="truncate text-sm font-semibold">{contextName}</span>
        </span>
        <MdExpandMore aria-hidden className={`icon shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <ul
        id={listId}
        hidden={!open}
        aria-label="Contextos disponíveis"
        className="absolute left-0 top-full z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-muted bg-surface p-1 shadow-lg"
      >
        {options.map((option) => {
          const current = option.id === currentOrgId;
          return (
            <li key={option.id === null ? "global" : option.id}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => pick(option.id)}
                className={`row min-h-10 w-full gap-2 rounded-md px-2 text-left text-sm hover:bg-white/5 ${current ? "font-semibold text-main" : ""}`}
              >
                {option.id === null
                  ? <MdPublic aria-hidden className="icon shrink-0" />
                  : <MdDomain aria-hidden className="icon shrink-0" />}
                <span className="flex-1 truncate">{option.name}</span>
                {current && <MdCheck aria-hidden className="icon shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
