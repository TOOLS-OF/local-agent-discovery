const fs = require('node:fs');
const fsp = fs.promises;
const crypto = require('node:crypto');

const digest = b => crypto.createHash('sha256').update(b).digest('hex');
async function checkpoint(file) {
  const realpath = await fsp.realpath(file);
  const s = await fsp.stat(realpath, { bigint: true });
  if (!s.isFile()) throw new Error('Tape must be a regular file');
  const h = await fsp.open(realpath, 'r');
  const sample = Buffer.alloc(Number(s.size < 16384n ? s.size : 16384n));
  try { await h.read(sample, 0, sample.length, 0); } finally { await h.close(); }
  return { realpath, size: Number(s.size), mtimeNs: String(s.mtimeNs), dev: String(s.dev), ino: String(s.ino), headSha256: digest(sample), fingerprintBytes: sample.length,
    identityStrength: 'file metadata plus first 16KiB; not a full-content hash' };
}
function positive(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
  return value;
}
async function walkTape(file, options, onRecord) {
  if (/\.(zst|gz|zip)$/i.test(file)) throw new Error('Compressed input unsupported in v0.1: supply an explicit lossless expanded JSONL snapshot');
  const limits = { maxInputBytes: 64 * 1024 * 1024, maxLineBytes: 16 * 1024 * 1024, maxEvents: 50000, maxSeconds: 60, ...options.budgets };
  Object.entries(limits).forEach(([k,v]) => positive(v,k));
  const before = await checkpoint(file);
  const cursor = options.cursor;
  if (cursor && JSON.stringify(cursor.checkpoint) !== JSON.stringify(before)) throw new Error('Source checkpoint changed; cannot resume this cursor');
  let offset = cursor?.offset || 0, line = cursor?.line || 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > before.size || !Number.isSafeInteger(line) || line < 0) throw new Error('Invalid cursor');
  if (offset) {
    const h = await fsp.open(file, 'r'); const previous = Buffer.alloc(1);
    try { await h.read(previous,0,1,offset-1); } finally { await h.close(); }
    if (offset < before.size && previous[0] !== 10) throw new Error('Cursor is not at a record boundary');
  }
  const initialOffset = offset, start = Date.now();
  let events = 0, bytesRead = 0, pending = Buffer.alloc(0), reason = null;
  const gaps = [], hash = crypto.createHash('sha256');
  async function consume(bytes, newline) {
    if (events >= limits.maxEvents) { reason = 'maxEvents'; return false; }
    if (Date.now() - start >= limits.maxSeconds * 1000) { reason = 'maxSeconds'; return false; }
    if (bytes.length > limits.maxLineBytes) { reason = 'maxLineBytes'; return false; }
    const location = { line: line + 1, offset, endOffset: offset + bytes.length + (newline ? 1 : 0) };
    let record;
    try { record = bytes.length ? JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) : null; }
    catch { gaps.push({ ...location, kind: 'malformed-json' }); }
    if (record) await onRecord(record, location);
    hash.update(bytes); if (newline) hash.update('\n');
    offset = location.endOffset; line++; events++;
    return true;
  }
  if (offset < before.size) {
    const end = Math.min(before.size, offset + limits.maxInputBytes) - 1;
    const stream = fs.createReadStream(file, {start:offset, end, highWaterMark:65536});
    outer: for await (const chunk of stream) {
      bytesRead += chunk.length;
      pending = Buffer.concat([pending, chunk]);
      let nl;
      while ((nl = pending.indexOf(10)) !== -1) {
        if (!await consume(pending.subarray(0,nl), true)) break outer;
        pending = pending.subarray(nl+1);
      }
      if (pending.length > limits.maxLineBytes) { reason = 'maxLineBytes'; break; }
      if (Date.now() - start >= limits.maxSeconds*1000) { reason = 'maxSeconds'; break; }
    }
    if (!reason && pending.length && end + 1 === before.size) await consume(pending, false);
    if (!reason && offset < before.size) reason = 'maxInputBytes';
  }
  const after = await checkpoint(file);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source changed during scan; discard this page');
  return { checkpoint:before, startOffset:initialOffset, endOffset:offset, records:events, bytesRead,
    segmentSha256:hash.digest('hex'), gaps, complete:offset === before.size, stopReason:reason,
    cursor: offset < before.size ? {checkpoint:before, offset, line} : null,
    coverageNote:'Plain JSONL page only. Metadata/head fingerprint does not prove whole-file immutability; segment digest covers consumed records. Cursor state is trusted local scan state.' };
}
module.exports = { walkTape, checkpoint, digest, positive };
