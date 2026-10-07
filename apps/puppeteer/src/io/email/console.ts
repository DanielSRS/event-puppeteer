import type { EmailMessage, EmailSender } from '../index.ts';

// Local development without a Brevo key: print the email instead of sending it
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(`📧 Para: ${message.to.email}\n   Assunto: ${message.subject}\n${message.text}`);
  }
}
