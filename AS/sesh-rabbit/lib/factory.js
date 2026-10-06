'use strict';
// sesh-rabbit/lib/factory.js
// createSensorium(harness) → AgentSensorium implementation

const { ClaudeCodeSensorium } = require('./adapters/claude-code.js');
const { CodexSensorium }      = require('./adapters/codex.js');
const { CopilotSensorium }    = require('./adapters/copilot.js');

function createSensorium(harness = 'claude-code') {
  switch (harness.toLowerCase().replace(/[-_ ]/g, '')) {
    case 'claudecode':
    case 'claude':
      return new ClaudeCodeSensorium();
    case 'codex':
      return new CodexSensorium();
    case 'copilot':
    case 'vscodecopliot':
      return new CopilotSensorium();
    default:
      throw new Error(`Unknown harness: ${harness}. Known: claude-code, codex, copilot`);
  }
}

module.exports = { createSensorium };
