import type { EmailMessage, EmailSender } from '../index.ts';

// Tests read what would have been delivered
export class InMemoryEmailSender implements EmailSender {
  sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
