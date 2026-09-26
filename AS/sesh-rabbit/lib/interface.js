'use strict';
// sesh-rabbit/lib/interface.js
//
// Common AgentSensorium interface.
//
// Implement this for each harness. Claude Code adapter is in
// adapters/claude-code.js. Codex and Copilot stubs are in their own
// files — fill them in when you have a real tape format to parse.
//
// CONTRACT
// ────────
// parseTape(tapePath)  → SensoriumData | null
// SensoriumData = {
//   events:     [{ ts: Number, role: 'user'|'agent'|'tool'|'system', meta?: {} }],
//   compactions: Number,           // compact_boundary events seen
//   instance:    Number,           // compactions + 1
//   firstTs:     Number,           // ms since epoch
//   lastTs:      Number,
// }
//
// computeStats(data) → SensoriumStats = {
//   duration:    Number (ms),
//   roleCounts:  { user, agent, tool, system },
//   latencies:   Number[],         // user→agent response times in ms
//   compactions: Number,
//   instance:    Number,
// }
//
// renderStatusline(stats, mode) → String
//   mode: 0=timeline 1=recent 2=ratio 3=latency
//   Single line of ANSI-colored block-art, ≤48 chars wide.
//   Must not write a newline.
//
// renderHUD(stats, { width? }) → String[]
//   Multi-line terminal display. Lines are ANSI-colored.
//   Progressive enhancement: call only when width > 0 is available.
//
// toJSON(stats) → Object
//   Pure-data output, no ANSI. Safe to JSON.stringify.

class AgentSensorium {
  // @param {string} tapePath — absolute path to the agent's session tape
  // @returns {SensoriumData|null}
  parseTape(tapePath) { throw new Error('parseTape not implemented'); }

  // @param {SensoriumData} data
  // @returns {SensoriumStats}
  computeStats(data) { throw new Error('computeStats not implemented'); }

  // @param {SensoriumStats} stats
  // @param {0|1|2|3} mode
  // @returns {string} single ANSI line
  renderStatusline(stats, mode) { throw new Error('renderStatusline not implemented'); }

  // @param {SensoriumStats} stats
  // @param {{ width?: number }} opts
  // @returns {string[]} lines
  renderHUD(stats, opts = {}) { throw new Error('renderHUD not implemented'); }

  // @param {SensoriumStats} stats
  // @returns {Object}
  toJSON(stats) { throw new Error('toJSON not implemented'); }

  // Convenience: parseTape + computeStats in one call
  sense(tapePath) {
    const data = this.parseTape(tapePath);
    if (!data) return null;
    return this.computeStats(data);
  }
}

module.exports = { AgentSensorium };
