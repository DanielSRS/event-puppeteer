/**
 * "Atualizado há 3 s": how fresh the feed on screen is.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { ElapsedLabel } from "@/utils/date";

export type UpdatedAgoProps = {
  /** When the data arrived (ms since epoch). */
  updatedAt: number;
};

/** Ticks once a second on its own, so the list around it doesn't re-render. A green dot marks it live. */
export function UpdatedAgo({ updatedAt }: UpdatedAgoProps) {
  const [now, setNow] = useState(updatedAt);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const label = ElapsedLabel(updatedAt, Math.max(now, updatedAt));
  return (
    <p className="t3 row gap-2 whitespace-nowrap text-xs">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ok)]" />
      {label === "agora" ? "Atualizado agora" : `Atualizado há ${label}`}
    </p>
  );
}
