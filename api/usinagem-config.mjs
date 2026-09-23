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
  return jwtRole(key) !== 'service_role';
}

export default function handler(request, response) {
  if (request.method && !['GET', 'HEAD'].includes(request.method)) {
    response.status(405).json({ error: 'Método não permitido' });
    return;
  }
  const url = String(process.env.VITE_USINAGEM_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(process.env.VITE_USINAGEM_SUPABASE_ANON_KEY || '');
  const safeKey = isPublicKey(anonKey) ? anonKey : '';
  response.status(200).json({
    configured: Boolean(url && safeKey),
    url,
    anonKey: safeKey,
    error: anonKey && !safeKey ? 'Use a chave pública Publishable/anon da Usinagem; service_role não é aceita.' : undefined
  });
}
