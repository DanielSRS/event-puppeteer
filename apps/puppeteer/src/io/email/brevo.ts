import type { EmailMessage, EmailSender } from '../index.ts';

// https://developers.brevo.com/docs/send-a-transactional-email
export class BrevoEmailSender implements EmailSender {
  constructor(
    private apiKey: string,
    private sender: { email: string; name: string },
    private fetchFn: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [message.to],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text
      })
    });
    if (!response.ok) {
      throw new Error(`EMAIL_DELIVERY_FAILED: Brevo answered ${response.status} ${await response.text()}`);
    }
  }
}
