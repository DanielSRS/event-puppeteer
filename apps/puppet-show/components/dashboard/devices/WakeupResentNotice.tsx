/**
 * What the person is told after sending the Wake-up of a waiting Command again: whether the
 * Device was told to fetch it now. A failed Wake-up is not an error of the request: the
 * Device still gets the Command on its next heartbeat.
 *
 * @module
 */

import type { WakeupOutcome } from "@/lib/api/schemas";
import { StatusMessage } from "@/components/ui/Feedback";

/** Props of {@link WakeupResentNotice}. */
export type WakeupResentNoticeProps = {
  /** Name of the Command as shown elsewhere on the page, e.g. “Reiniciar”. */
  commandLabel: string;
  /** Outcome of the Wake-up answered by Puppeteer. */
  wakeup: WakeupOutcome;
};

/** Says whether the Device was woken up again, with the delay when it was not. */
export function WakeupResentNotice({ commandLabel, wakeup }: WakeupResentNoticeProps) {
  if (wakeup.sent) {
    return <StatusMessage>{`Aviso reenviado para o comando “${commandLabel}”. O dispositivo foi avisado e o recebe em instantes.`}</StatusMessage>;
  }
  return (
    <StatusMessage>
      {`O aviso do comando “${commandLabel}” falhou de novo (${wakeup.reason}). O dispositivo o receberá no próximo heartbeat, em até 20 s.`}
    </StatusMessage>
  );
}
