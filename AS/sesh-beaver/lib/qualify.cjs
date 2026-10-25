'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const adapter = require('sesh-stork/lib/codex-standalone.cjs');
async function qualify(r) {
  if (!path.isAbsolute(r.output) || fs.existsSync(r.output))
    throw Error('Qualification needs new absolute output directory');
  adapter.plain(path.dirname(r.output), true);
  adapter.plain(r.codex);
  fs.mkdirSync(r.output);
  const home = path.join(r.output, 'test-home'),
    cwd = path.join(r.output, 'workspace');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  const sid = crypto.randomUUID(),
    parent = crypto.randomUUID(),
    turn = crypto.randomUUID(),
    tape = path.join(r.output, `rollout-2000-01-01T00-00-00-${sid}.jsonl`),
    timestamp = '2026-01-01T00:00:00.000Z';
  const rows = [
    {
      timestamp,
      type: 'session_meta',
      payload: {
        id: sid,
        timestamp,
        cwd,
        originator: 'synthetic-beaver-test',
        cli_version: '0.0.0',
        source: {
          subagent: {
            thread_spawn: {
              parent_thread_id: parent,
              depth: 1,
              agent_nickname: 'SyntheticChild',
              agent_role: 'worker',
            },
          },
        },
        thread_source: 'subagent',
        model_provider: 'openai',
      },
    },
    {
      timestamp,
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Synthetic standalone visibility canary',
          },
        ],
      },
    },
  ];
  rows.splice(
    1,
    0,
    {
      timestamp,
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: turn },
    },
    {
      timestamp,
      type: 'turn_context',
      payload: {
        turn_id: turn,
        cwd,
        approval_policy: 'never',
        sandbox_policy: { type: 'read-only' },
        model: 'gpt-6.1-sol',
        effort: 'low',
        summary: 'auto',
      },
    },
    {
      timestamp,
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: 'Sesh Beaver Standalone Canary',
        images: [],
        local_images: [],
        text_elements: [],
      },
    },
  );
  rows.push({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'task_complete',
      turn_id: turn,
      last_agent_message: 'Synthetic complete fixture.',
    },
  });
  fs.writeFileSync(tape, rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const req = {
    codex: r.codex,
    home,
    cwd,
    sourceId: sid,
    sourceTape: tape,
    sourceSha256: adapter.digest(tape),
    evidence: path.join(r.output, 'prepare'),
    title: 'Renamed Independent Beaver',
    strategy: 'native-fork-new-id',
    disposition: 'standalone',
    acceptNewIdentity: true,
    quiescence: {
      sourceId: sid,
      status: 'idle',
      owner: 'synthetic qualifier',
      evidence: 'Inactive synthetic fixture; no writer',
      offlineSource: true,
      observedAt: new Date().toISOString(),
    },
  };
  const result = await adapter.run('prepare', req);
  const repeat = await adapter.run('prepare', req);
  if (repeat.destinationId !== result.destinationId)
    throw Error('Idempotence failed');
  if (
    !result.visibility.interactiveTitleSearchListed ||
    !result.visibility.interactiveListed ||
    !result.visibility.historicalTitleSearchListed
  )
    throw Error('Distinct requested-name/historical queries did not both pass');
  const runtimeDir = path.join(home, 'sessions/2026/01/01');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const runtime = path.join(runtimeDir, path.basename(tape));
  fs.copyFileSync(tape, runtime, fs.constants.COPYFILE_EXCL);
  const repairRequest = {
    ...req,
    sourceTape: runtime,
    evidence: path.join(r.output, 'repair'),
    lastTurnId: turn,
    quiescence: {
      ...req.quiescence,
      offlineSource: false,
      observedAt: new Date().toISOString(),
    },
  };
  const repaired = await adapter.run('repair', repairRequest);
  const repeatedRepair = await adapter.run('repair', repairRequest);
  if (repeatedRepair.destinationId !== repaired.destinationId)
    throw Error('Repair idempotence failed');
  const emptyId = crypto.randomUUID(),
    emptyTape = path.join(
      r.output,
      `rollout-2000-01-01T00-00-00-${emptyId}.jsonl`,
    );
  const emptyRows = rows
    .filter((x) => x.type === 'session_meta' || x.type === 'response_item')
    .map((x) => structuredClone(x));
  emptyRows[0].payload.id = emptyId;
  fs.writeFileSync(
    emptyTape,
    emptyRows.map((x) => JSON.stringify(x)).join('\n') + '\n',
  );
  const emptyRequest = {
    ...req,
    sourceId: emptyId,
    sourceTape: emptyTape,
    sourceSha256: adapter.digest(emptyTape),
    evidence: path.join(r.output, 'empty-index'),
    quiescence: {
      ...req.quiescence,
      sourceId: emptyId,
      observedAt: new Date().toISOString(),
    },
  };
  let emptyRefused = false;
  try {
    await adapter.run('prepare', emptyRequest);
  } catch (e) {
    if (!e.message.includes('acceptance incomplete')) throw e;
    emptyRefused = true;
  }
  if (!emptyRefused)
    throw Error(
      'Missing-user-event fixture unexpectedly passed; inspect source/list semantics',
    );
  const { DatabaseSync } = require('node:sqlite'),
    db = new DatabaseSync(
      path.join(emptyRequest.evidence, 'operation.sqlite'),
      { readOnly: true },
    );
  let emptyResult;
  try {
    emptyResult = JSON.parse(
      db.prepare('SELECT result_json FROM operation WHERE singleton=1').get()
        .result_json,
    );
  } finally {
    db.close();
  }
  if (
    !emptyResult.destinationId ||
    emptyResult.state !== 'acceptance-incomplete' ||
    emptyResult.visibility.interactiveListed
  )
    throw Error(
      'Empty-index incomplete destination was not retained correctly',
    );
  return {
    result,
    repaired,
    idempotent: true,
    emptyIndexRequiresCommissioning: true,
    testHome: home,
    noLiveSessionTouched: true,
    cleanup:
      'Test home retained until dependency/runtime-independence check; never a durable agent workspace',
  };
}
module.exports = { qualify };
