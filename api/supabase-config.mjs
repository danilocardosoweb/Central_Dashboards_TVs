function jwtRole(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return String(payload.role || '');
  } catch {
    return '';
  }
}

function isPublicKey(value) {
  const key = String(value || '');
  if (!key || /^sb_(secret|service_role)_/i.test(key)) return false;
  if (/^sb_publishable_/i.test(key)) return true;
  return jwtRole(key) === 'anon';
}

export default function handler(request, response) {
  if (request.method && !['GET', 'HEAD'].includes(request.method)) {
    response.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const candidate = process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY || '';
  const publishableKey = isPublicKey(candidate) ? String(candidate) : '';

  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    configured: Boolean(url && publishableKey),
    url,
    publishableKey,
    error: candidate && !publishableKey
      ? 'Use uma chave pública Publishable/anon; chaves administrativas não são aceitas.'
      : undefined
  });
}
