import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', 'emergency-media');
const port = Number(process.env.EMERGENCY_PORT || 8787);
const advertise = process.env.EMERGENCY_HOST || '192.168.0.122';
const playlistPath = path.join(root, 'playlist.json');

const contentTypes = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4'
};

function safeName(value) {
  const name = path.basename(String(value || ''));
  if (!name || name !== String(value)) throw new Error('Nome de arquivo inválido.');
  return name;
}

async function emergencyState() {
  const raw = await fs.readFile(playlistPath, 'utf8');
  const playlist = JSON.parse(raw);
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  const urls = [];
  const alerts = [];
  for (const [index, item] of items.entries()) {
    const file = safeName(item.file);
    const url = `http://${advertise}:${port}/media/${encodeURIComponent(file)}`;
    const duration = Math.max(5, Number(item.duration) || 20);
    if (String(item.type || '').toLowerCase() === 'video' || file.toLowerCase().endsWith('.mp4')) {
      alerts.push({
        id: `emergency-${index + 1}`,
        title: item.title || 'Comunicado emergencial',
        body: '',
        mediaType: 'video',
        mediaUrl: url,
        contentType: 'image',
        enabled: true,
        duration,
        targetStations: ['*'],
        targetAreas: ['*']
      });
    } else {
      urls.push({
        id: `emergency-${index + 1}`,
        name: item.title || file,
        active: true,
        imageUrl: url,
        duration,
        targetStations: ['*'],
        targetAreas: ['*']
      });
    }
  }
  return {
    revision: 1,
    updated_at: new Date().toISOString(),
    payload: {
      urls,
      areas: [],
      stations: [],
      alerts,
      ppr: { enabled: false },
      settings: { transitionTime: 20000, transitionEffect: 'fade', transitionDuration: 800, countdownEnabled: false }
    }
  };
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/emergency.json') {
      const body = JSON.stringify(await emergencyState());
      response.writeHead(200, { 'Content-Type': contentTypes['.json'], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      response.end(body);
      return;
    }
    if (request.url?.startsWith('/media/')) {
      const name = decodeURIComponent(request.url.slice('/media/'.length));
      const file = safeName(name);
      const body = await fs.readFile(path.join(root, file));
      const ext = path.extname(file).toLowerCase();
      response.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      response.end(body);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Emergência local: rota não encontrada.');
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
});

await fs.mkdir(root, { recursive: true });
server.listen(port, '0.0.0.0', () => {
  console.log(`Emergência local disponível em http://${advertise}:${port}/emergency.json`);
  console.log(`Coloque imagens PNG/JPG/WEBP ou vídeos MP4 em ${root}.`);
});
