'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  registry = require('./repository-operations.json'),
  pkg = require('./package.json');
function check() {
  for (const verb of Object.keys(registry.operations))
    if (
      pkg.scripts[`${registry.namespace}:${verb}`] !==
      `node repository-release.cjs ${verb}`
    )
      throw Error('Unregistered release verb');
  return { registered: true, owner: registry.owner, issue: registry.issue };
}
function validate(r) {
  if (
    r.team !== 'OTTOBOT-00Q' ||
    r.repo !== 'TOOLS-OF/local-agent-discovery' ||
    r.remote !== 'https://github.com/TOOLS-OF/local-agent-discovery.git' ||
    r.target !== 'main' ||
    !/^ottobot-00q\/[a-z0-9-]+$/.test(r.branch) ||
    !/^[0-9a-f]{40}$/.test(r.head) ||
    !/^[0-9a-f]{40}$/.test(r.base)
  )
    throw Error(
      'Explicit approved owner/repo/remote/branch/head/main/base binding required',
    );
}
function run(file, args) {
  const r = cp.spawnSync(file, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(r.stderr || r.stdout || `${file} failed`);
  return r.stdout.trim();
}
function gh(args) {
  return run('gh', args);
}
function json(args) {
  return JSON.parse(gh(args));
}
function currentBase(r) {
  const raw = run('git', ['ls-remote', 'origin', 'refs/heads/main']);
  const sha = raw.split(/\s/)[0];
  if (sha !== r.base)
    throw Error(
      `Main base changed: expected ${r.base}, actual ${sha}; rebind before mutation`,
    );
  return sha;
}
function pr(r) {
  const p = json([
    'pr',
    'view',
    String(r.pr),
    '--repo',
    r.repo,
    '--json',
    'number,url,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,statusCheckRollup,mergeStateStatus',
  ]);
  if (
    p.headRefName !== r.branch ||
    p.headRefOid !== r.head ||
    p.baseRefName !== r.target ||
    p.baseRefOid !== r.base
  )
    throw Error('PR ownership/head/base differs from approved binding');
  return p;
}
function reviewBinding(r) {
  if (
    r.review?.head !== r.head ||
    r.review?.outcome !== 'no-blockers' ||
    !r.review?.owner
  )
    throw Error('Attributed independent review for exact head required');
}
async function main(args) {
  check();
  const [verb, file, ...extra] = args;
  if (
    !Object.hasOwn(registry.operations, verb) ||
    extra.length ||
    (verb === 'check' ? !!file : !file)
  )
    throw Error('Unregistered release operation or invalid arguments');
  if (verb === 'check') return check();
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  validate(r);
  if (run('git', ['remote', 'get-url', 'origin']) !== r.remote)
    throw Error('Wrong repository remote');
  const login = gh(['api', 'user', '--jq', '.login']);
  if (login.toLowerCase() !== 'ottopoet-thesean')
    throw Error(
      'Preferred scoped GitHub identity is not active; no account switch performed',
    );
  const info = json(['api', `repos/${r.repo}`]);
  if (!info.permissions?.push || info.default_branch !== r.target)
    throw Error('Missing repository permission or changed mainline');
  currentBase(r);
  if (verb === 'inspect')
    return { login, repo: r.repo, base: r.base, pr: r.pr ? pr(r) : null };
  if (verb === 'publish') {
    if (
      run('git', ['branch', '--show-current']) !== r.branch ||
      run('git', ['rev-parse', 'HEAD']) !== r.head ||
      run('git', ['status', '--porcelain'])
    )
      throw Error('Publish requires own exact clean checkout');
    if (
      !r.title ||
      !path.isAbsolute(r.bodyFile) ||
      !fs.statSync(r.bodyFile).isFile()
    )
      throw Error('Concrete PR title/body file required');
    run('git', [
      '-c',
      'credential.helper=',
      '-c',
      'credential.helper=!gh auth git-credential',
      'push',
      r.remote,
      `HEAD:refs/heads/${r.branch}`,
    ]);
    const matches = json([
      'pr',
      'list',
      '--repo',
      r.repo,
      '--head',
      r.branch,
      '--base',
      r.target,
      '--state',
      'open',
      '--json',
      'number,url,headRefOid',
    ]);
    if (matches.length) {
      if (matches.length !== 1 || matches[0].headRefOid !== r.head)
        throw Error('Existing PR collision');
      return matches[0];
    }
    currentBase(r);
    return {
      url: gh([
        'pr',
        'create',
        '--repo',
        r.repo,
        '--base',
        r.target,
        '--head',
        r.branch,
        '--title',
        r.title,
        '--body-file',
        r.bodyFile,
      ]),
    };
  }
  reviewBinding(r);
  const p = pr(r);
  if (p.state !== 'OPEN' || p.isDraft) throw Error('PR is not open and ready');
  if (verb === 'review') {
    if (!path.isAbsolute(r.review.bodyFile))
      throw Error('Exact review evidence file required');
    return json([
      'api',
      '--method',
      'POST',
      `repos/${r.repo}/pulls/${r.pr}/reviews`,
      '-f',
      'event=COMMENT',
      '-f',
      `commit_id=${r.head}`,
      '-F',
      `body=@${r.review.bodyFile}`,
    ]);
  }
  const checks = p.statusCheckRollup;
  if (
    !Array.isArray(checks) ||
    checks.length < 4 ||
    checks.some((x) => x.status !== 'COMPLETED' || x.conclusion !== 'SUCCESS')
  )
    throw Error(
      'Four successful completed CI jobs required; pending/failing checks block merge',
    );
  const reviews = json(['api', `repos/${r.repo}/pulls/${r.pr}/reviews`]);
  if (
    !reviews.some(
      (x) =>
        x.commit_id === r.head &&
        x.body.includes(r.review.owner) &&
        x.body.includes('No remaining blocking findings'),
    )
  )
    throw Error('Exact-head independent review evidence is not posted');
  currentBase(r);
  gh([
    'pr',
    'merge',
    String(r.pr),
    '--repo',
    r.repo,
    '--merge',
    '--match-head-commit',
    r.head,
  ]);
  return json([
    'pr',
    'view',
    String(r.pr),
    '--repo',
    r.repo,
    '--json',
    'url,state,mergedAt,mergeCommit,headRefOid,baseRefName',
  ]);
}
if (require.main === module)
  main(process.argv.slice(2))
    .then((x) => console.log(JSON.stringify(x)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
module.exports = { validate, check, main };
