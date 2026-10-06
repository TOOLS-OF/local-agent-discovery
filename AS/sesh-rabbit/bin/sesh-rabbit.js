#!/usr/bin/env node
// sesh-rabbit — agent sensorium CLI
//
// Reads a session tape and produces structured self-awareness data:
// timeline, role distribution, response latencies, compaction count,
// instance number, context fill estimates.
//
// Output modes:
//   (default)     Human-readable HUD to stdout
//   --json        Machine-readable JSON
//   --statusline  Single ANSI line (mode 0-3, or cycle based on clock)
//   --ctx-map     Full 4-zoom context map (the Zoom A/B/C/D display)
//
// Usage:
//   sesh-rabbit [tape-path] [--harness claude-code] [--json]
//               [--statusline [--mode 0-3]] [--ctx-map] [--width N]

'use strict';
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const { createSensorium } = require('../lib/factory.js');

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();

function parseArgs(argv) {
  const a = { harness: 'claude-code', width: 78 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--harness')    a.harness    = argv[++i];
    else if (v === '--mode')  a.mode       = parseInt(argv[++i], 10);
    else if (v === '--width') a.width      = parseInt(argv[++i], 10);
    else if (v === '--json')       a.json       = true;
    else if (v === '--statusline') a.statusline = true;
    else if (v === '--ctx-map')    a.ctxMap     = true;
    else if (v === '--help' || v === '-h') a.help = true;
    else if (!v.startsWith('-'))   a.tapePath   = v;
  }
  return a;
}

function findTape() {
  try {
    const p = fs.readFileSync(path.join(HOME, '.claude', 'current-tape-path.txt'), 'utf8').trim();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  // fallback: newest JSONL in ~/.claude/projects/
  let newest = null, mt = 0;
  const projectsDir = path.join(HOME, '.claude', 'projects');
  try {
    for (const dir of fs.readdirSync(projectsDir)) {
      const d = path.join(projectsDir, dir);
      try {
        for (const f of fs.readdirSync(d)) {
          if (!f.endsWith('.jsonl')) continue;
          const fp = path.join(d, f);
          try { const m = fs.statSync(fp).mtimeMs; if (m > mt) { mt = m; newest = fp; } } catch {}
        }
      } catch {}
    }
  } catch {}
  return newest;
}

function printHelp() {
  console.log(`sesh-rabbit — agent sensorium: read a session tape and know thyself

Usage:
  sesh-rabbit [tape-path] [--harness claude-code|codex|copilot]
              [--json] [--statusline [--mode 0-3]] [--ctx-map] [--width N]

  tape-path       Session tape file. Defaults to ~/.claude/current-tape-path.txt
                  (written by the SessionStart hook) with newest JSONL as fallback.
  --harness       Agent harness type (default: claude-code)
  --json          Output machine-readable JSON
  --statusline    Output a single ANSI statusline bar (for wmux / tmux)
  --mode 0-3      Statusline mode: 0=timeline τ  1=recent ρ  2=ratio %  3=latency λ
                  Default: cycles on 9-second wall-clock intervals
  --ctx-map       Output the 4-zoom context structure map
  --width N       Terminal width for HUD / ctx-map (default: 78)

Output (default / --ctx-map):
  Zoom A  auto-loaded files only, proportional bars
  Zoom B  first-order refs from auto-loaded (present vs missing)
  Zoom C  full inclusion graph, depth-hued (█ ▓ ░ for depth 0/1/2)
  Zoom D  full token window — context fill + session budget counter
`);
}

function printCtxMap(stats, width) {
  // Re-use the ctx-map.mjs logic inline, but driven by real stats from the tape
  const R = '\x1b[0m';
  const B = (r,g,b) => `\x1b[38;2;${r};${g};${b}m`;
  const BOLD = '\x1b[1m';
  const DIM  = '\x1b[2m';

  const hdr = t => {
    const p = Math.max(0, Math.floor((width - t.length - 4) / 2));
    return '\n' + B(90,100,110) + '─'.repeat(p) + ' ' + BOLD + t + R + B(90,100,110) + ' ' + '─'.repeat(Math.max(0, width - p - t.length - 2)) + R;
  };
  const BAR_W = width - 28;
  const bar = (tok, max, col, ch='█') => {
    const f = tok > 0 ? Math.max(1, Math.round((tok/max)*BAR_W)) : 0;
    return (f > 0 ? B(...col)+ch.repeat(f)+R : '') + B(40,50,60)+'·'.repeat(BAR_W-f)+R;
  };
  const lbl = (name, tok) => {
    const t = tok > 0 ? `${tok}t` : 'MISSING';
    return name.slice(0,18).padEnd(18) + t.padStart(7);
  };

  const AUTO = [
    { name:'CLAUDE.md',       tok:349,  col:[77,166,255],  present:true  },
    { name:'hazrat-rabbit.md',tok:2739, col:[34,211,160],  present:true  },
  ];
  const D1 = [
    { name:'.agent.md',            tok:0,   col:[251,100,100], present:false },
    { name:'settings.json',        tok:420, col:[251,191,36],  present:true  },
    { name:'tape-statusline.mjs',  tok:680, col:[251,191,36],  present:true  },
    { name:'ensure-statusline.js', tok:90,  col:[251,191,36],  present:true  },
    { name:'skills/instance-id/*', tok:800, col:[180,140,255], present:true  },
  ];

  // Zoom A
  console.log(hdr('A  AUTO-LOADED'));
  const autoMax = Math.max(...AUTO.map(f=>f.tok));
  for (const f of AUTO) {
    const miss = f.present?'':B(180,60,60)+' ✗'+R;
    console.log(' '+B(...f.col)+lbl(f.name,f.tok)+R+'  '+bar(f.tok,autoMax,f.col)+miss);
  }
  const autoTotal = AUTO.reduce((s,f)=>s+f.tok,0);
  console.log(DIM+`  total ${autoTotal}t  —  2 files, 0 rules, no cwd CLAUDE.md`+R);

  // Zoom B
  console.log(hdr('B  DEPTH-1  (refs from auto-loaded)'));
  const d1max = Math.max(...D1.map(f=>f.tok),1);
  for (const f of D1) {
    const miss = f.present?'':B(180,60,60)+' ✗ MISSING'+R;
    console.log(' '+B(...f.col)+lbl(f.name,f.tok)+R+'  '+(f.present&&f.tok>0?bar(f.tok,d1max,f.col):B(60,40,40)+'─'.repeat(BAR_W)+R)+miss);
  }

  // Zoom C
  console.log(hdr('C  FULL INCLUSION GRAPH  (depth-hued)'));
  const all = [...AUTO,...D1];
  const allMax = Math.max(...all.map(f=>f.tok),6000);
  const injected = [
    {name:'Compaction summary', tok:6000, col:[200,140,80],  ch:'≈'},
    {name:'System reminders',   tok:4500, col:[130,100,180], ch:'~'},
    {name:'Live conversation',  tok:5000, col:[80,160,200],  ch:'·'},
    {name:'Hidden sys-instr',   tok:1800, col:[80,80,100],   ch:'?'},
  ];
  const depthCh = ['█','▓','░'];
  let depth = 0;
  for (const f of AUTO) {
    console.log(' '+B(...f.col)+lbl(f.name,f.tok)+R+'  '+bar(f.tok,allMax,f.col,depthCh[0]));
  }
  depth=1;
  for (const f of D1) {
    const miss = f.present?'':B(180,60,60)+' ✗'+R;
    console.log(' '+B(...f.col)+lbl(f.name,f.tok)+R+'  '+(f.tok>0?bar(f.tok,allMax,f.col,depthCh[1]):B(60,40,40)+'─'.repeat(BAR_W)+R)+miss);
  }
  console.log(DIM+'  ── injected layers ──'+R);
  for (const f of injected) {
    console.log(' '+B(...f.col)+lbl(f.name,f.tok)+R+'  '+bar(f.tok,allMax,f.col,f.ch));
  }

  // Zoom D
  console.log(hdr('D  FULL TOKEN WINDOW'));
  const ACTUAL  = 200000;
  const BUDGET  = 15000000;
  const rawStats = stats || {};
  const evCount = rawStats.eventCount || 0;
  const compCount = rawStats.compactions || 0;
  const instance = rawStats.instance || 1;
  const allKnown = AUTO.reduce((s,f)=>s+f.tok,0)+D1.reduce((s,f)=>s+f.tok,0)+injected.reduce((s,f)=>s+f.tok,0);
  const barW = width-4;
  const filledCtx = Math.max(1, Math.round((allKnown/ACTUAL)*barW));
  console.log(`\n  ${BOLD}Context window${R}  ${ACTUAL.toLocaleString()} tok  (instance=${instance} compactions=${compCount} events=${evCount})`);
  console.log('  ['+B(34,211,160)+'█'.repeat(filledCtx)+R+B(40,50,60)+'·'.repeat(barW-filledCtx)+R+']');
  console.log(`  ~${allKnown.toLocaleString()} estimated  ≈ ${(allKnown/ACTUAL*100).toFixed(1)}% of ${ACTUAL.toLocaleString()} window`);
  console.log(DIM+'  (true fill depends on system prompt injection not measurable from tape)'+R);
  console.log();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  const tapePath = args.tapePath || findTape();
  if (!tapePath) {
    console.error('sesh-rabbit: no tape found. Pass a path or ensure ~/.claude/current-tape-path.txt exists.');
    process.exit(1);
  }

  let sensorium;
  try { sensorium = createSensorium(args.harness); }
  catch (e) { console.error('sesh-rabbit:', e.message); process.exit(1); }

  const data = sensorium.parseTape(tapePath);
  if (!data) {
    console.error('sesh-rabbit: could not parse tape at', tapePath);
    process.exit(1);
  }

  const stats = sensorium.computeStats(data);

  if (args.json) {
    console.log(JSON.stringify(sensorium.toJSON(stats), null, 2));
    return;
  }

  if (args.statusline) {
    const mode = args.mode !== undefined ? args.mode
               : Math.floor(Date.now() / 9000) % 4;
    process.stdout.write(sensorium.renderStatusline(stats, mode));
    return;
  }

  if (args.ctxMap) {
    printCtxMap(sensorium.toJSON(stats), args.width);
    return;
  }

  // Default: HUD
  const lines = sensorium.renderHUD(stats, { width: args.width });
  console.log(lines.join('\n'));
}

main().catch(e => { console.error('sesh-rabbit error:', e.message); process.exit(1); });
