'use strict';
// sesh-rabbit/lib/adapters/copilot.js — STUB
//
// VS Code Copilot Chat session tapes live at:
//   <vscode-config>/User/workspaceStorage/<hash>/chatSessions/<uuid>.jsonl
//
// Folder→hash mapping via workspace.json "folder" URI.
// Verified discovery logic exists in sesh-hound.
//
// TODO: map Copilot JSONL types to common event schema and implement
// all AgentSensorium methods.

const { AgentSensorium } = require('../interface.js');

class CopilotSensorium extends AgentSensorium {
  parseTape(_tapePath) {
    throw new Error('CopilotSensorium.parseTape: not yet implemented — see lib/adapters/copilot.js');
  }
  computeStats(_data) { throw new Error('not yet implemented'); }
  renderStatusline(_stats, _mode) { throw new Error('not yet implemented'); }
  renderHUD(_stats, _opts) { throw new Error('not yet implemented'); }
  toJSON(_stats) { throw new Error('not yet implemented'); }
}

module.exports = { CopilotSensorium };
