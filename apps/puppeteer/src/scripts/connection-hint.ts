// Supabase's direct host (db.<ref>.supabase.co) resolves to IPv6 only, which most
// networks (and Vercel) cannot reach. Turn that failure into an actionable message.
export function ipv6UnreachableHint(error: any, variable: string, pooler: 'Session' | 'Transaction') {
  const cause = error?.cause ?? error;
  if (cause?.code !== 'ENETUNREACH' || !String(cause?.address).includes(':')) return null;
  const port = pooler === 'Session' ? 5432 : 6543;
  return `❌ Sem rota IPv6 até ${cause.address}. No Supabase, use em ${variable} a URL do ${pooler} pooler ` +
    `(postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:${port}/postgres), não o host db.<ref>.supabase.co.`;
}
