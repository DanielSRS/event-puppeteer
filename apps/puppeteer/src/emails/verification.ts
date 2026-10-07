import type { EmailMessage } from '../io/index.ts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function verificationEmail(to: { email: string; name: string }, link: string): EmailMessage {
  const name = escapeHtml(to.name);
  const href = escapeHtml(link);
  return {
    to,
    subject: 'Confirme seu email',
    text: `Olá, ${to.name}!\n\nConfirme seu email para ativar sua conta:\n${link}\n\nSe você não criou uma conta, ignore este email.`,
    html: `<p>Olá, ${name}!</p>
<p>Confirme seu email para ativar sua conta:</p>
<p><a href="${href}">Confirmar email</a></p>
<p>Se o botão não funcionar, copie este link no navegador:<br>${href}</p>
<p>Se você não criou uma conta, ignore este email.</p>`
  };
}
