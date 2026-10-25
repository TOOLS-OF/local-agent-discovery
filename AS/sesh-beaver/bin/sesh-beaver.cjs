#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
function registry() {
  const r = JSON.parse(
    fs.readFileSync(path.join(root, 'operations.json'), 'utf8'),
  );
  const p = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  if (!r.owner || !r.issue || !r.dependencies)
    throw Error('Incomplete operation registry');
  for (const k of Object.keys(r.operations))
    if (p.scripts[`sesh:beaver:${k}`] !== `node bin/sesh-beaver.cjs ${k}`)
      throw Error(`Unregistered script: ${k}`);
  return r;
}
async function main(args) {
  const r = registry();
  const [verb, file, ...extra] = args;
  if (verb === '--help')
    return {
      namespace: r.namespace,
      operations: Object.keys(r.operations),
      input:
        'One JSON request filename; check accepts none. Same-ID conversion unsupported.',
    };
  if (
    !Object.hasOwn(r.operations, verb) ||
    extra.length ||
    (verb === 'check' ? !!file : !file)
  )
    throw Error('Unregistered operation or invalid arguments');
  if (verb === 'check')
    return { registryValid: true, installedFleetEnforcement: false };
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (verb === 'status') {
    const { DatabaseSync } = require('node:sqlite');
    if (
      !path.isAbsolute(request.database) ||
      fs.lstatSync(request.database).isSymbolicLink()
    )
      throw Error('Explicit regular ledger path required');
    const db = new DatabaseSync(request.database, { readOnly: true });
    try {
      return db
        .prepare('SELECT state,result_json FROM operation WHERE singleton=1')
        .get();
    } finally {
      db.close();
    }
  }
  if (verb === 'qualify') return require('../lib/qualify.cjs').qualify(request);
  if (verb === 'cleanup') return require('../lib/cleanup.cjs').cleanup(request);
  if (verb === 'package')
    return require('../lib/package-check.cjs').validate(request);
  if (verb === 'format') {
    const scripts = path.resolve(root, '../../scripts');
    if (
      !fs.existsSync(path.join(scripts, 'package-lock.json')) ||
      !path.isAbsolute(request.npmCli)
    )
      throw Error('Owned source worktree and explicit npm CLI required');
    const args = [
      request.npmCli,
      'ci',
      '--prefix',
      scripts,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ];
    const install = cp.spawnSync(process.execPath, args, {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (install.status !== 0) throw Error(install.stderr);
    const result = cp.spawnSync(
      process.execPath,
      [
        path.join(scripts, 'node_modules/prettier/bin/prettier.cjs'),
        '--write',
        path.join(root, '**/*.cjs'),
        path.resolve(root, '../sesh-stork/lib/*.cjs'),
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (result.status !== 0) throw Error(result.stderr);
    return {
      formatted: true,
      dependencyLock: path.join(scripts, 'package-lock.json'),
    };
  }
  if (verb === 'schema') {
    if (
      !path.isAbsolute(request.codex) ||
      !path.isAbsolute(request.output) ||
      fs.existsSync(request.output)
    )
      throw Error('Schema needs explicit executable and new absolute output');
    const { plain } = require('../../sesh-stork/lib/codex-standalone.cjs');
    plain(path.dirname(request.output), true);
    plain(request.codex);
    const result = cp.spawnSync(
      request.codex,
      [
        'app-server',
        'generate-json-schema',
        '--experimental',
        '--out',
        request.output,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (result.status !== 0)
      throw Error(result.stderr || 'Schema generation failed');
    return { output: request.output };
  }
  return require('sesh-stork/lib/codex-standalone.cjs').run(verb, request);
}
if (require.main === module)
  main(process.argv.slice(2))
    .then((x) => console.log(JSON.stringify(x)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
module.exports = { main, registry };
