import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, realpathSync, lstatSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function qaPlan(root, session = randomUUID()) {
  const sessionDir = path.join(root, '.qa', 'sessions', session);
  const dataDir = path.join(sessionDir, 'data');
  const targetDir = path.join(root, '.qa', 'target');
  const config = JSON.parse(readFileSync(path.join(root, 'editor/src-tauri/tauri.conf.json'), 'utf8'));
  return {
    session, sessionDir, dataDir, targetDir,
    configPath: path.join(sessionDir, 'tauri.qa.json'),
    env: {
      SLATE_ENV: 'qa', SLATE_QA_SESSION: session, SLATE_DATA_DIR: dataDir,
      CARGO_TARGET_DIR: targetDir, CARGO_BUILD_TARGET_DIR: targetDir,
      SLATE_QA_VITE_CACHE_DIR: path.join(sessionDir, 'vite-cache'),
      SLATE_QA_FRONTEND_DIST: path.join(sessionDir, 'editor-dist'),
      VITE_SLATE_ENV: 'qa', VITE_SLATE_QA_SESSION: session,
    },
    config: {
      identifier: 'com.slate.editor.qa', productName: 'Slate Editor QA',
      build: {
        // Config-relative frontend path is absolute so the overlay location cannot redirect it.
        frontendDist: path.join(sessionDir, 'editor-dist'),
        devUrl: 'http://127.0.0.1:1420',
        beforeBuildCommand: 'npm run build -- --configLoader runner',
        beforeDevCommand: 'npm run dev -- --host 127.0.0.1 --configLoader runner',
      },
      app: { windows: config.app.windows.map(window => ({ ...window, title: 'Slate Editor QA' })) },
      bundle: { externalBin: [path.join(sessionDir, 'binaries', 'slate-server')] },
    },
  };
}

export function requireFreePort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is occupied. Close the existing application yourself; QA will not stop or reuse it.`)));
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => probe.close(resolve));
  });
}

export function prepare(plan) {
  // Fail closed if any QA artifact ancestor redirects into another directory.
  for (const directory of [path.dirname(path.dirname(plan.sessionDir)), path.dirname(plan.sessionDir), plan.sessionDir, plan.targetDir]) {
    mkdirSync(directory, { recursive: true });
    if (lstatSync(directory).isSymbolicLink() || realpathSync(directory).toLowerCase() !== path.resolve(directory).toLowerCase()) {
      throw new Error('QA directories must not contain links or junctions');
    }
  }
  mkdirSync(plan.dataDir); // Never adopt an existing data directory.
  writeFileSync(path.join(plan.dataDir, '.slate-qa-session'), plan.session, { flag: 'wx' });
  writeFileSync(plan.configPath, JSON.stringify(plan.config, null, 2), { flag: 'wx' });
  writeFileSync(path.join(plan.sessionDir, 'session.json'), JSON.stringify({
    session: plan.session, dataDir: plan.dataDir, targetDir: plan.targetDir,
  }, null, 2), { flag: 'wx' });
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status ?? result.signal})`);
}

async function main() {
  if (process.platform !== 'win32') throw new Error('The Slate QA sidecar build currently supports Windows only.');
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--build-only', '--prepare-only'].includes(flag))) throw new Error('Supported options: --build-only, --prepare-only');
  await requireFreePort(8000);
  await requireFreePort(1420);
  const plan = qaPlan(repo);
  prepare(plan);
  const env = { ...process.env, ...plan.env };
  // Do not inherit configuration overlays or alternate Cargo targets from another workflow.
  delete env.TAURI_CONFIG;
  delete env.CARGO_BUILD_TARGET;
  console.log(`QA session: ${plan.session}\nData: ${plan.dataDir}\nCargo: ${plan.targetDir}\nConfig: ${plan.configPath}`);
  if (flags.includes('--prepare-only')) return;
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(repo, 'server/scripts/build_server.ps1'), '-QaSessionDir', plan.sessionDir], repo, env);
  // A personal application may have started while the sidecar was building.
  await requireFreePort(8000);
  await requireFreePort(1420);
  const build = flags.includes('--build-only');
  run(process.execPath, [path.join(repo, 'editor/node_modules/@tauri-apps/cli/tauri.js'),
    ...(build ? ['build', '--debug', '--no-bundle'] : ['dev', '--no-watch']),
    '--config', plan.configPath], path.join(repo, 'editor'), env);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`QA stopped: ${error.message}`); process.exitCode = 1; });
}
