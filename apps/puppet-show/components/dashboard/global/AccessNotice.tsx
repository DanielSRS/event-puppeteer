/**
 * What an admin page shows instead of its content when the person can't use
 * it in the current context, so a page never fires requests the API would
 * refuse with 403.
 *
 * @module
 */

import { ErrorAlert } from "@/components/ui/Feedback";
import { SelectOrgNotice, type SectionDenial } from "../DashboardContext";

/** Explanation for a {@link SectionDenial}. */
export function AccessNotice({ denial }: { denial: SectionDenial }) {
  if (denial === "needs-org") return <SelectOrgNotice />;
  if (denial === "needs-global")
    return <p className="card text-center text-foreground/80">Esta página é do contexto global. Escolha “Global” no seletor de contexto para vê-la.</p>;
  return <ErrorAlert>Sem permissão: seu papel nesta organização não permite ver esta página.</ErrorAlert>;
}
