'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process');
function validate(r) {
  if (
    !path.isAbsolute(r.output) ||
    fs.existsSync(r.output) ||
    !path.isAbsolute(r.npmCli) ||
    !path.isAbsolute(r.codex)
  )
    throw Error('Explicit executable paths and new absolute output required');
  const { plain } = require('../../sesh-stork/lib/codex-standalone.cjs');
  plain(path.dirname(r.output), true);
  plain(r.npmCli);
  plain(r.codex);
  fs.mkdirSync(r.output);
  const tar = path.join(r.output, 'tarballs'),
    prefix = path.join(r.output, 'installation');
  fs.mkdirSync(tar);
  fs.mkdirSync(prefix);
  function exec(file, args) {
    const x = cp.spawnSync(file, args, {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (x.status !== 0)
      throw Error(x.stderr || x.stdout || 'Package validation failed');
    return x.stdout;
  }
  const beaver = path.resolve(__dirname, '..'),
    stork = path.resolve(beaver, '../sesh-stork');
  for (const src of [stork, beaver])
    exec(process.execPath, [
      r.npmCli,
      'pack',
      src,
      '--pack-destination',
      tar,
      '--ignore-scripts',
      '--json',
    ]);
  const packages = fs
    .readdirSync(tar)
    .filter((x) => x.endsWith('.tgz'))
    .map((x) => path.join(tar, x));
  exec(process.execPath, [
    r.npmCli,
    'install',
    '--prefix',
    prefix,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...packages,
  ]);
  const bin = path.join(prefix, 'node_modules/sesh-beaver/bin/sesh-beaver.cjs');
  const check = JSON.parse(exec(process.execPath, [bin, 'check']));
  exec(process.execPath, [
    path.join(prefix, 'node_modules/sesh-stork/bin/sesh-stork.js'),
    '--help',
  ]);
  const request = path.join(r.output, 'qualification-request.json');
  fs.writeFileSync(
    request,
    JSON.stringify({
      codex: r.codex,
      output: path.join(r.output, 'qualification'),
    }),
    { flag: 'wx' },
  );
  const qualification = JSON.parse(
    exec(process.execPath, [bin, 'qualify', request]),
  );
  return { prefix, check, qualification, canonicalDefault: false };
}
module.exports = { validate };
