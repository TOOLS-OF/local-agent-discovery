// Polymorphic session delivery: places a finished session file into a
// target harness's storage convention for a given folder, and verifies it
// actually boots there. Mirrors SessionDiscovery / boundary-reconstruction's
// one-abstract-concept-per-harness pattern.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function homeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

class SessionDelivery {
  // Returns the on-disk directory this harness would use for a given cwd.
  computeDestinationDir(cwd) { throw new Error('impl'); }
  // Copies sessionFile into that directory under sessionId, returns the final path.
  async deliver(sessionFile, cwd, sessionId) { throw new Error('impl'); }
  // Launches the harness against the delivered session and confirms a real
  // response comes back — not just that the file exists.
  async verifyBoot(sessionId, cwd) { throw new Error('impl'); }
}

class ClaudeSessionDelivery extends SessionDelivery {
  constructor(opts = {}) {
    super();
    this.harness = 'claude-code';
    this.storageRoot = opts.storageRoot || path.join(homeDir(), '.claude', 'projects');
  }

  // Verified empirically 2026-09-19 against a real Claude Code project
  // folder: exactly '-' + every non-alphanumeric character replaced with
  // '-'. The leading '-' is not part of the replace pass itself — Claude
  // POSIX-ifies the path (implicit leading separator) before slugging it.
  _slugForCwd(cwd) {
    return '-' + cwd.replace(/[^a-zA-Z0-9]/g, '-');
  }

  computeDestinationDir(cwd) {
    return path.join(this.storageRoot, this._slugForCwd(cwd));
  }

  async deliver(sessionFile, cwd, sessionId) {
    const destDir = this.computeDestinationDir(cwd);
    fs.mkdirSync(destDir, { recursive: true });
    const destFile = path.join(destDir, `${sessionId}.jsonl`);
    if (path.resolve(destFile) === path.resolve(sessionFile)) {
      throw new Error('deliver(): source and destination are the same file - refusing to no-op copy onto itself');
    }
    fs.copyFileSync(sessionFile, destFile);
    return destFile;
  }

  // Takes the delivered file's own path, not a bare session id. Verified
  // empirically 2026-09-19: `claude --resume <bare-id>` failed with
  // "No conversation found" for a session placed by direct file copy into
  // a freshly-computed project folder, even though the folder and file were
  // exactly right - Claude's bare-id lookup appears to depend on an index
  // populated by Claude's own writes, not live recomputation from cwd on
  // every invocation. `claude --resume <full-path>` against the identical
  // file, from the identical cwd, succeeded immediately. Full path is the
  // reliable form; don't regress to bare id without re-verifying.
  async verifyBoot(sessionFilePath, cwd) {
    const probe = `SESH-STORK-BOOT-CHECK-${path.basename(sessionFilePath, '.jsonl').slice(0, 8)}`;
    try {
      const raw = execSync(
        `claude --resume "${sessionFilePath}" -p "Reply with exactly and only this token: ${probe}"`,
        { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
      );
      return { ok: raw.includes(probe), raw: raw.trim() };
    } catch (e) {
      return { ok: false, raw: (e.stdout || '') + (e.stderr || ''), error: e.message };
    }
  }
}

function createSessionDelivery(harness, opts = {}) {
  switch (harness.toLowerCase()) {
    case 'claude-code': case 'claude': return new ClaudeSessionDelivery(opts);
    default: throw new Error('No SessionDelivery for harness: ' + harness);
  }
}

module.exports = { SessionDelivery, ClaudeSessionDelivery, createSessionDelivery };
