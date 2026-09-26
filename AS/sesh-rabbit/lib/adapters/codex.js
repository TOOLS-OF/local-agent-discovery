'use strict';
// sesh-rabbit/lib/adapters/codex.js — STUB
//
// Codex session tapes live at:
//   ~/.codex/sessions/YYYY/MM/DD/rollout-<uuid>.jsonl
//
// First line is a session_meta event with "cwd" and "model".
// Verified cwd-extraction logic exists in sesh-hound.
//
// TODO: map Codex JSONL types to the common event schema:
//   { ts, role: 'user'|'agent'|'tool'|'system' }
// then implement computeStats, renderStatusline, renderHUD, toJSON
// by delegation to the base class helpers in lib/common.js (TBD).

const { AgentSensorium } = require('../interface.js');

class CodexSensorium extends AgentSensorium {
  parseTape(_tapePath) {
    throw new Error('CodexSensorium.parseTape: not yet implemented — see lib/adapters/codex.js');
  }
  computeStats(_data) {
    throw new Error('CodexSensorium.computeStats: not yet implemented');
  }
  renderStatusline(_stats, _mode) {
    throw new Error('CodexSensorium.renderStatusline: not yet implemented');
  }
  renderHUD(_stats, _opts) {
    throw new Error('CodexSensorium.renderHUD: not yet implemented');
  }
  toJSON(_stats) {
    throw new Error('CodexSensorium.toJSON: not yet implemented');
  }
}

module.exports = { CodexSensorium };
