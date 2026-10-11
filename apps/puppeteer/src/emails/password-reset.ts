import type { EmailMessage } from '../io/index.ts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Email with the link to choose a new password. The link opens the frontend's
 * reset page and expires after `validMinutes`.
 */
export function passwordResetEmail(to: { email: string; name: string }, link: string, validMinutes: number): EmailMessage {
  const name = escapeHtml(to.name);
  const href = escapeHtml(link);
  return {
    to,
    subject: 'Redefinir sua senha',
    text: `Olá, ${to.name}!\n\nRecebemos um pedido para redefinir a senha da sua conta. Para escolher uma nova senha, abra o link abaixo (válido por ${validMinutes} minutos):\n${link}\n\nSe você não pediu, ignore este email: sua senha continua a mesma.`,
    html: `<p>Olá, ${name}!</p>
<p>Recebemos um pedido para redefinir a senha da sua conta. Para escolher uma nova senha, use o botão abaixo (válido por ${validMinutes} minutos):</p>
<p><a href="${href}">Escolher nova senha</a></p>
<p>Se o botão não funcionar, copie este link no navegador:<br>${href}</p>
<p>Se você não pediu, ignore este email: sua senha continua a mesma.</p>`
  };
}
