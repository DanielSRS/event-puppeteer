import type { EmailMessage, EmailSender } from '../index.ts';

const API = 'https://api.brevo.com/v3';

// https://developers.brevo.com/docs/send-a-transactional-email
export class BrevoEmailSender implements EmailSender {
  constructor(
    private apiKey: string,
    private sender: { email: string; name: string },
    private fetchFn: typeof fetch = fetch
  ) {}

  private headers() {
    return { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' };
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchFn(`${API}/smtp/email`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        sender: this.sender,
        to: [message.to],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text
      })
    });
    if (!response.ok) {
      const error = `EMAIL_DELIVERY_FAILED: Brevo answered ${response.status} ${await response.text()}`;
      console.error(`📧 ❌ ${message.to.email}: ${error}`);
      throw new Error(error);
    }
    // Accepted is not delivered: Brevo may still reject later (e.g. invalid sender), see checkSender
    const { messageId } = await response.json().catch(() => ({})) as { messageId?: string };
    console.log(`📧 Aceito pelo Brevo para ${message.to.email} (${messageId ?? 'sem messageId'})`);
  }

  // Brevo accepts a send from an unverified sender (201) and only rejects it afterwards,
  // silently from our side. Returns a warning when that would happen, null when the sender is valid.
  async checkSender(): Promise<string | null> {
    const get = async (path: string) => {
      const response = await this.fetchFn(`${API}${path}`, { headers: this.headers() });
      if (!response.ok) throw new Error(`Brevo answered ${response.status} on ${path}`);
      return response.json() as Promise<any>;
    };
    const [{ senders = [] }, { domains = [] }] = await Promise.all([get('/senders'), get('/senders/domains')]);
    const email = this.sender.email.toLowerCase();
    const domain = email.split('@')[1];

    const activeSenders: string[] = senders.filter((s: any) => s.active).map((s: any) => String(s.email).toLowerCase());
    const authenticatedDomains: string[] = domains.filter((d: any) => d.authenticated).map((d: any) => String(d.domain_name).toLowerCase());
    if (activeSenders.includes(email) || authenticatedDomains.includes(domain ?? '')) return null;

    return `EMAIL_FROM=${this.sender.email} não é um remetente válido no Brevo: os envios serão recusados. ` +
      `Remetentes válidos: ${activeSenders.join(', ') || 'nenhum'}; domínios autenticados: ${authenticatedDomains.join(', ') || 'nenhum'}.`;
  }
}
