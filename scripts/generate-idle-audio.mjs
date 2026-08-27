import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'roku', 'audio', 'idle-guard.wav');
const sampleRate = 44_100;
const seconds = 2;
const channels = 1;
const bitsPerSample = 16;
const samples = sampleRate * seconds;
const dataSize = samples * channels * (bitsPerSample / 8);
const wav = Buffer.alloc(44 + dataSize);

wav.write('RIFF', 0, 'ascii');
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8, 'ascii');
wav.write('fmt ', 12, 'ascii');
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(channels, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
wav.writeUInt16LE(channels * (bitsPerSample / 8), 32);
wav.writeUInt16LE(bitsPerSample, 34);
wav.write('data', 36, 'ascii');
wav.writeUInt32LE(dataSize, 40);

// O Roku precisa reconhecer uma reproducao de midia real para nao classificar
// o canal como inativo. Uma onda de amplitude 1 em PCM 16-bit fica abaixo do
// nivel audivel normal, mas evita que o arquivo seja apenas silencio digital.
for (let sample = 0; sample < samples; sample += 1) {
  const value = sample % 2 === 0 ? 1 : -1;
  wav.writeInt16LE(value, 44 + sample * 2);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, wav);
console.log(`Audio de protecao praticamente inaudivel criado: ${target} (${wav.length} bytes)`);
