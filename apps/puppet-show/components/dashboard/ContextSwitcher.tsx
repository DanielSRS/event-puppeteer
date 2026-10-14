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
import { MdCheck, MdDomain, MdPublic, MdUnfoldMore } from "react-icons/md";
import { Monogram } from "@/utils/monogram";

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

  const global = currentOrgId === null;
  const icon = (
    <span
      aria-hidden
      className={`center h-8 w-8 shrink-0 rounded-[9px] ${global ? "c-info" : "ink"}`}
      style={{ background: global ? "var(--info-bg)" : "var(--accent-soft)" }}
    >
      {global ? <MdPublic className="h-[18px] w-[18px]" /> : <MdDomain className="h-[18px] w-[18px]" />}
    </span>
  );
  const box = "row w-full min-h-14 gap-2.5 rounded-2xl border px-3 py-2 text-left";
  const boxStyle = { borderColor: "var(--line-2)", background: "var(--well)" };

  if (!canSwitch) {
    return (
      <div className={box} style={boxStyle}>
        {icon}
        <span className="column min-w-0 flex-1 leading-tight">
          <span className="truncate font-semibold">{contextName}</span>
          <span className="t3 text-xs">Sua organização</span>
        </span>
      </div>
    );
  }

  function pick(orgId: string | null) {
    setOpen(false);
    buttonRef.current?.focus();
    if (orgId !== currentOrgId) onSelect(orgId);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`${box} cursor-pointer transition-colors hover:bg-foreground/5 focus-ring`}
        style={boxStyle}
      >
        {icon}
        <span className="column min-w-0 flex-1 leading-tight">
          <span className="truncate font-semibold">{contextName}</span>
          <span className="t3 text-xs">
            {global ? "Todas as organizações" : "Agindo como Admin"}
            <span className="sr-only"> · Contexto (trocar)</span>
          </span>
        </span>
        <MdUnfoldMore aria-hidden className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      <ul
        id={listId}
        hidden={!open}
        aria-label="Contextos disponíveis"
        className="glass-strong absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-[18px] p-1.5"
      >
        {[{ id: null as string | null, name: "Sistema Global" }, ...organizations.map((org) => ({ id: org.id as string | null, name: org.name }))].map((option, index) => {
          const current = option.id === currentOrgId;
          return (
            <li key={option.id === null ? "global" : option.id}>
              {index === 1 && <p aria-hidden className="caption px-3 pb-1 pt-2">Organizações</p>}
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => pick(option.id)}
                className="nav-item w-full text-left text-sm aria-[current=true]:bg-foreground/10 aria-[current=true]:font-semibold aria-[current=true]:text-foreground"
              >
                {option.id === null
                  ? <MdPublic aria-hidden className="c-info h-4 w-4 shrink-0" />
                  : <span aria-hidden className="logo-tile h-[22px] w-[22px] rounded-md text-[9px]">{Monogram(option.name)}</span>}
                <span className="flex-1 truncate">{option.name}</span>
                {current && <MdCheck aria-hidden className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
