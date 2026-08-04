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
