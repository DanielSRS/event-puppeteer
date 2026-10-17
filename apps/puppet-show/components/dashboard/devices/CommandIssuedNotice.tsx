/**
 * What the person is told after issuing a Command: the Command was stored, and whether the
 * Wake-up that makes the Device fetch it right away was sent. A failed Wake-up is not an
 * error of the request: the Device still gets the Command on its next heartbeat.
 *
 * @module
 */

import type { WakeupOutcome } from "@/lib/api/schemas";
import { StatusMessage } from "@/components/ui/Feedback";

/** Props of {@link CommandIssuedNotice}. */
export type CommandIssuedNoticeProps = {
  /** Name of the Command as shown elsewhere on the page, e.g. “Reiniciar”. */
  commandLabel: string;
  /** Outcome of the Wake-up answered together with the Command. */
  wakeup: WakeupOutcome;
};

/** Confirms the Command and says whether the Device was woken up, with the delay when it was not. */
export function CommandIssuedNotice({ commandLabel, wakeup }: CommandIssuedNoticeProps) {
  if (wakeup.sent) {
    return <StatusMessage>{`Comando “${commandLabel}” enviado. O dispositivo foi avisado e o recebe em instantes.`}</StatusMessage>;
  }
  return (
    <StatusMessage>
      {`Comando “${commandLabel}” enviado, mas o aviso ao dispositivo falhou (${wakeup.reason}). O dispositivo o receberá no próximo heartbeat, em até 20 s.`}
    </StatusMessage>
  );
}
