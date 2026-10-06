'use strict';
// sesh-rabbit/lib/adapters/claude-code.js
//
// AgentSensorium implementation for Claude Code JSONL tapes.
//
// Tape format (empirically verified 2026-09-25 on OTTOPOET-00Q):
//   Each line is a JSON object.  Relevant fields:
//     .type             'user' | 'assistant' | 'system' | 'summary'
//     .timestamp        ISO 8601 string
//     .message.content  Array of content blocks (assistant) or string (user)
//     .message.content[].type  'text' | 'tool_use' | 'tool_result'
//   Compaction boundary events have .type === 'system' and either:
//     .content contains 'compact_boundary'   (observed form A)
//   OR the entry is a summary/context-reset event (observed form B).
//
// Role mapping:
//   'user'      → role 'user'
//   'assistant' with tool_use block → role 'tool'
//   'assistant' without tool_use   → role 'agent'
//   'system'                       → role 'system'
//   'summary'                      → compaction marker, not an event

const fs = require('fs');
const { AgentSensorium } = require('../interface.js');

class ClaudeCodeSensorium extends AgentSensorium {
  parseTape(tapePath) {
    let raw;
    try { raw = fs.readFileSync(tapePath, 'utf8'); } catch { return null; }

    const events = [];
    let compactions = 0;

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }

      // Compaction boundary detection
      if (obj.type === 'system') {
        const c = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content || '');
        if (c.includes('compact_boundary') || c.includes('compacted')) {
          compactions++;
          continue;
        }
      }
      if (obj.type === 'summary') { compactions++; continue; }

      // Timestamp
      if (!obj.timestamp) continue;
      const ts = new Date(obj.timestamp).getTime();
      if (!isFinite(ts)) continue;

      // Role
      let role;
      if (obj.type === 'user') {
        role = 'user';
      } else if (obj.type === 'assistant') {
        const c = obj.message?.content;
        role = (Array.isArray(c) && c.some(b => b.type === 'tool_use')) ? 'tool' : 'agent';
      } else if (obj.type === 'system') {
        role = 'system';
      } else {
        continue;
      }

      events.push({ ts, role, meta: { type: obj.type } });
    }

    if (events.length === 0) return null;
    events.sort((a, b) => a.ts - b.ts);

    return {
      events,
      compactions,
      instance: compactions + 1,
      firstTs: events[0].ts,
      lastTs:  events[events.length - 1].ts,
    };
  }

  computeStats(data) {
    const { events, compactions, instance, firstTs, lastTs } = data;

    const roleCounts = { user: 0, agent: 0, tool: 0, system: 0 };
    for (const e of events) roleCounts[e.role] = (roleCounts[e.role] || 0) + 1;

    // Latencies: user event → next agent/tool event after it
    const agentEvents = events.filter(e => e.role === 'agent' || e.role === 'tool');
    const latencies = [];
    for (const e of events.filter(e => e.role === 'user')) {
      const next = agentEvents.find(a => a.ts > e.ts);
      if (next) latencies.push(next.ts - e.ts);
    }

    return {
      events,
      duration:    lastTs - firstTs,
      firstTs,
      lastTs,
      roleCounts,
      latencies,
      compactions,
      instance,
    };
  }

  renderStatusline(stats, mode = 0) {
    const W = 44;
    const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const R = '\x1b[0m';
    const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
    const COL = {
      user:  [77,  166, 255],
      agent: [34,  211, 160],
      tool:  [251, 191, 36],
      system:[124, 111, 224],
      gap:   [40,  64,  90],
      lbl:   [90,  120, 150],
    };
    const LABELS = ['τ', 'ρ', '%', 'λ'];
    const label = rgb(...COL.lbl) + LABELS[mode] + ' ' + R;

    const { events, latencies, roleCounts } = stats;
    if (!events || events.length < 2) {
      return label + rgb(...COL.gap) + '─'.repeat(W) + R;
    }

    function makeBins(evts, start, span, n) {
      const bins = Array.from({ length: n }, () => ({ user: 0, agent: 0, tool: 0, system: 0 }));
      const bMs = span / n;
      for (const e of evts) {
        const i = Math.min(n - 1, Math.floor((e.ts - start) / bMs));
        if (i >= 0) bins[i][e.role] = (bins[i][e.role] || 0) + 1;
      }
      return bins;
    }

    function dominant(b) {
      return b.tool >= b.user && b.tool >= b.agent ? 'tool'
           : b.user >= b.agent ? 'user'
           : b.agent >= b.system ? 'agent'
           : 'system';
    }

    function binsToBar(bins) {
      const maxCount = Math.max(...bins.map(b =>
        (b.user || 0) + (b.agent || 0) + (b.tool || 0) + (b.system || 0)), 1);
      return bins.map(b => {
        const tot = (b.user||0)+(b.agent||0)+(b.tool||0)+(b.system||0);
        if (tot === 0) return rgb(...COL.gap) + '─' + R;
        const bi = Math.max(1, Math.ceil((tot / maxCount) * (BLOCKS.length - 1)));
        return rgb(...COL[dominant(b)]) + BLOCKS[bi] + R;
      }).join('');
    }

    const { firstTs, lastTs } = stats;

    if (mode === 0) { // τ timeline
      const bins = makeBins(events, firstTs, lastTs - firstTs, W);
      return label + binsToBar(bins);
    }

    if (mode === 1) { // ρ recent 44 min
      const now = Date.now();
      const start = now - W * 60 * 1000;
      const recent = events.filter(e => e.ts >= start);
      if (recent.length === 0) return label + rgb(...COL.gap) + '─'.repeat(W) + R;
      return label + binsToBar(makeBins(recent, start, W * 60 * 1000, W));
    }

    if (mode === 2) { // % ratio
      const total = Object.values(roleCounts).reduce((s, v) => s + v, 0);
      if (total === 0) return label + rgb(...COL.gap) + '─'.repeat(W) + R;
      let out = '', used = 0;
      const roles = ['user', 'agent', 'tool', 'system'];
      for (let i = 0; i < roles.length; i++) {
        const r = roles[i];
        const chars = i === roles.length - 1
          ? W - used
          : Math.round((roleCounts[r] || 0) / total * W);
        if (chars <= 0) continue;
        out += rgb(...COL[r]) + '█'.repeat(chars) + R;
        used += chars;
      }
      return label + out;
    }

    if (mode === 3) { // λ latency
      if (latencies.length === 0) return label + rgb(...COL.gap) + '─'.repeat(W) + R;
      const last = latencies.slice(-W);
      const pad = W - last.length;
      const LOG_MIN = Math.log10(100), LOG_MAX = Math.log10(300000);
      let out = rgb(...COL.gap) + '·'.repeat(pad) + R;
      for (const ms of last) {
        const l = Math.max(LOG_MIN, Math.min(LOG_MAX, Math.log10(Math.max(1, ms))));
        const bi = Math.max(1, Math.ceil(((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (BLOCKS.length - 1)));
        const col = ms < 10000 ? COL.agent : ms < 30000 ? COL.tool : COL.user;
        out += rgb(...col) + BLOCKS[bi] + R;
      }
      return label + out;
    }

    return label + rgb(...COL.gap) + '─'.repeat(W) + R;
  }

  renderHUD(stats, { width = 78 } = {}) {
    const R = '\x1b[0m';
    const B = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
    const BOLD = '\x1b[1m';
    const DIM  = '\x1b[2m';
    const { events, roleCounts, latencies, compactions, instance, duration, firstTs, lastTs } = stats;

    const BAR_W = width - 28;
    const bar = (count, max, col, ch = '█') => {
      const f = Math.max(1, Math.round((count / max) * BAR_W));
      return B(...col) + ch.repeat(f) + R + B(40, 50, 60) + '·'.repeat(BAR_W - f) + R;
    };

    const lines = [];
    const hdr = t => {
      const p = Math.max(0, Math.floor((width - t.length - 4) / 2));
      return B(90,100,110) + '─'.repeat(p) + ' ' + BOLD + t + R + B(90,100,110) + ' ' + '─'.repeat(Math.max(0, width - p - t.length - 2)) + R;
    };

    lines.push(hdr('SENSORIUM  instance=' + instance + '  compactions=' + compactions));

    // Duration
    const dur = duration / 1000;
    const h = Math.floor(dur / 3600), m = Math.floor((dur % 3600) / 60), s = Math.floor(dur % 60);
    lines.push(DIM + `  session span: ${h}h ${m}m ${s}s   events: ${events.length}` + R);

    // Role bars
    lines.push(hdr('ROLE DISTRIBUTION'));
    const maxCount = Math.max(...Object.values(roleCounts), 1);
    const roles = [
      { k: 'user',   col: [77,166,255],  ch: '█' },
      { k: 'agent',  col: [34,211,160],  ch: '█' },
      { k: 'tool',   col: [251,191,36],  ch: '▓' },
      { k: 'system', col: [124,111,224], ch: '░' },
    ];
    for (const { k, col, ch } of roles) {
      const n = roleCounts[k] || 0;
      const lbl = (k + ' ' + n).padEnd(12);
      lines.push(' ' + B(...col) + lbl + R + '  ' + (n > 0 ? bar(n, maxCount, col, ch) : B(40,50,60) + '·'.repeat(BAR_W) + R));
    }

    // Latency summary
    if (latencies.length > 0) {
      lines.push(hdr('LATENCIES  (user→agent, ms)'));
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const med = latencies.slice().sort((a,b)=>a-b)[Math.floor(latencies.length/2)];
      const max = Math.max(...latencies);
      lines.push(DIM + `  n=${latencies.length}  avg=${avg}ms  median=${med}ms  max=${max}ms` + R);
      // Sparkline
      const W = BAR_W + 14;
      const BLOCKS = [' ','▁','▂','▃','▄','▅','▆','▇','█'];
      const LOG_MIN = Math.log10(100), LOG_MAX = Math.log10(300000);
      const last = latencies.slice(-W);
      let spark = '  ';
      for (const ms of last) {
        const l = Math.max(LOG_MIN, Math.min(LOG_MAX, Math.log10(Math.max(1, ms))));
        const bi = Math.max(1, Math.ceil(((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (BLOCKS.length - 1)));
        const col = ms < 10000 ? [34,211,160] : ms < 30000 ? [251,191,36] : [77,166,255];
        spark += B(...col) + BLOCKS[bi] + R;
      }
      lines.push(spark);
    }

    return lines;
  }

  toJSON(stats) {
    const { events: _e, ...rest } = stats; // drop event array for brevity
    return {
      ...rest,
      eventCount: _e ? _e.length : 0,
      harness: 'claude-code',
    };
  }
}

module.exports = { ClaudeCodeSensorium };
