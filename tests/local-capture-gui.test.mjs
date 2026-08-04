import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const guiPath = new URL('../scripts/capture-local-gui.ps1', import.meta.url);

test('interface local usa a sobrecarga compatível de BeginInvoke', async () => {
  const source = await readFile(guiPath, 'utf8');
  assert.doesNotMatch(source, /\.BeginInvoke\(\$action\)/);
  assert.match(source, /\.BeginInvoke\(\$callback, \[object\[\]\]@\(\)\)/);
  assert.match(source, /\[System\.Windows\.Forms\.MethodInvoker\]/);
});

test('interface local persiste o log e confirma o resultado pelo temporizador', async () => {
  const source = await readFile(guiPath, 'utf8');
  assert.match(source, /capture-local-ui\.log/);
  assert.match(source, /function Read-CaptureLog/);
  assert.match(source, /\$pollTimer\.Add_Tick/);
  assert.match(source, /Captura concluída\. Os dashboards e as imagens do PPR foram enviados ao Supabase\./);
  assert.doesNotMatch(source, /add_OutputDataReceived|add_ErrorDataReceived|add_Exited/);
});
