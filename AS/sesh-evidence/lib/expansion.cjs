const fs = require('node:fs'),
  fsp = fs.promises,
  zlib = require('node:zlib'),
  crypto = require('node:crypto'),
  path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { checkpoint, positive } = require('./tape.cjs');
async function expandTapeSnapshot(source, output, options = {}) {
  const limits = {
    maxInputBytes: 1024 ** 3,
    maxDecodedBytes: 4 * 1024 ** 3,
    maxSeconds: 120,
    ...options.budgets,
  };
  Object.entries(limits).forEach(([k, v]) => positive(v, k));
  const before = await checkpoint(source);
  if (before.size > limits.maxInputBytes)
    throw new Error('Compressed input byte budget exceeded');
  if (path.resolve(source) === path.resolve(output))
    throw new Error('Expansion cannot replace source');
  let decoder;
  if (/\.zst$/i.test(source)) {
    if (typeof zlib.createZstdDecompress !== 'function')
      throw new Error('This Node runtime has no Zstandard decoder');
    decoder = zlib.createZstdDecompress();
  } else if (/\.gz$/i.test(source)) decoder = zlib.createGunzip();
  else throw new Error('Expected .zst or .gz lossless input');
  // Open exclusively first, so a failed precondition never removes another owner's path.
  const handle = await fsp.open(output, 'wx');
  await handle.close();
  let owned = true,
    inputBytes = 0,
    decodedBytes = 0;
  const inputHash = crypto.createHash('sha256'),
    outputHash = crypto.createHash('sha256'),
    start = Date.now();
  const inputMeter = new Transform({
    transform(chunk, encoding, cb) {
      inputBytes += chunk.length;
      if (inputBytes > limits.maxInputBytes)
        return cb(new Error('Input budget exceeded'));
      inputHash.update(chunk);
      cb(null, chunk);
    },
  });
  const outputMeter = new Transform({
    transform(chunk, encoding, cb) {
      decodedBytes += chunk.length;
      if (
        decodedBytes > limits.maxDecodedBytes ||
        Date.now() - start > limits.maxSeconds * 1000
      )
        return cb(new Error('Decoded-byte or time budget exceeded'));
      outputHash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(
      fs.createReadStream(source),
      inputMeter,
      decoder,
      outputMeter,
      fs.createWriteStream(output, { flags: 'r+' }),
    );
    if (JSON.stringify(before) !== JSON.stringify(await checkpoint(source)))
      throw new Error('Source changed during expansion');
    const sourceSha256 = inputHash.digest('hex');
    if (
      options.expectedSourceSha256 &&
      sourceSha256 !== options.expectedSourceSha256
    )
      throw new Error('Preserved input digest mismatch');
    return {
      schema: 'sesh-lossless-expansion/v1',
      source: before,
      output: path.resolve(output),
      inputBytes,
      decodedBytes,
      sourceSha256,
      outputSha256: outputHash.digest('hex'),
      lossless: true,
      sourceRewritten: false,
    };
  } catch (e) {
    if (owned) await fsp.unlink(output);
    throw e;
  }
}
module.exports = { expandTapeSnapshot };
