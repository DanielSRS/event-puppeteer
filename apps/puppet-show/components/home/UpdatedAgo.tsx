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

/** Ticks once a second on its own, so the list around it doesn't re-render. */
export function UpdatedAgo({ updatedAt }: UpdatedAgoProps) {
  const [now, setNow] = useState(updatedAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const label = ElapsedLabel(updatedAt, Math.max(now, updatedAt));
  return (
    <p className="text-xs text-foreground/80">
      {label === "agora" ? "Atualizado agora" : `Atualizado há ${label}`}
    </p>
  );
}
