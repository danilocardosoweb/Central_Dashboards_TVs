import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scene = fs.readFileSync(new URL('../roku/components/MainScene.brs', import.meta.url), 'utf8');
const sceneXml = fs.readFileSync(new URL('../roku/components/MainScene.xml', import.meta.url), 'utf8');
const task = fs.readFileSync(new URL('../roku/components/HeartbeatTask.brs', import.meta.url), 'utf8');
const central = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('heartbeat roda em tarefa independente e não controla o carrossel', () => {
  assert.match(sceneXml, /id="heartbeatTimer" duration="60" repeat="true"/);
  assert.match(scene, /CreateObject\("roSGNode", "HeartbeatTask"\)/);
  assert.match(task, /AsyncPostFromString/);
  assert.doesNotMatch(task, /slideTimer/);
});

test('Central possui monitor e atualização periódica', () => {
  assert.match(central, /id="tvPresenceList"/);
  assert.match(central, /\/api\/tv-status/);
  assert.match(central, /setInterval\(\(\) => refreshTvPresence\(true\), 30000\)/);
  assert.match(central, /newStationIp/);
});
