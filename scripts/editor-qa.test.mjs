import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { qaPlan, prepare, requireFreePort } from './editor-qa.mjs';

test('sessions isolate data and every build output from development', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'slate-qa-plan-'));
  t.after(() => rmSync(root, { recursive: true }));
  mkdirSync(path.join(root, 'editor/src-tauri'), { recursive: true });
  writeFileSync(path.join(root, 'editor/src-tauri/tauri.conf.json'), JSON.stringify({ app: { windows: [{ title: 'Slate' }] } }));
  const first = qaPlan(root);
  const second = qaPlan(root);
  assert.notEqual(first.dataDir, second.dataDir);
  assert.notEqual(first.config.bundle.externalBin[0], second.config.bundle.externalBin[0]);
  assert.equal(first.targetDir, path.join(root, '.qa/target'));
  assert.equal(first.env.SLATE_ENV, 'qa');
  assert.equal(first.env.SLATE_QA_SESSION, first.session);
  assert.ok(first.config.build.frontendDist.startsWith(first.sessionDir));
  assert.ok(first.config.bundle.externalBin[0].startsWith(first.sessionDir));
  prepare(first);
  prepare(second);
  assert.equal(readFileSync(path.join(first.dataDir, '.slate-qa-session'), 'utf8'), first.session);
  assert.throws(() => prepare(first));
  assert.equal(existsSync(path.join(root, 'editor/src-tauri/target')), false);
  assert.equal(existsSync(path.join(root, 'editor/src-tauri/binaries')), false);
});

test('occupied resources fail without reusing or terminating the listener', async t => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  await assert.rejects(requireFreePort(server.address().port), /will not stop or reuse/);
  assert.equal(server.listening, true);
});
