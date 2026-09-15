export default function handler(request, response) {
  if (request.method && !['GET', 'HEAD'].includes(request.method)) {
    response.status(405).json({ error: 'Método não permitido' });
    return;
  }
  const url = String(process.env.VITE_USINAGEM_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(process.env.VITE_USINAGEM_SUPABASE_ANON_KEY || '');
  response.status(200).json({ configured: Boolean(url && anonKey), url, anonKey });
}
