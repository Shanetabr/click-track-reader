'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readWav, analyzeWav } = require('..');

// Builds a WAV file from interleaved samples in -1..1.
function wav(samples, { channels = 1, rate = 8000, bits = 16, float = false, extensible = false } = {}) {
  const width = bits / 8;
  const fmtSize = extensible ? 40 : 16;
  const dataSize = samples.length * width;
  const buf = Buffer.alloc(12 + 8 + fmtSize + 8 + dataSize);
  let o = 0;
  const str = (s) => { buf.write(s, o, 'ascii'); o += 4; };
  const u32 = (v) => { buf.writeUInt32LE(v, o); o += 4; };
  const u16 = (v) => { buf.writeUInt16LE(v, o); o += 2; };
  str('RIFF'); u32(buf.length - 8); str('WAVE');
  str('fmt '); u32(fmtSize);
  u16(extensible ? 0xfffe : float ? 3 : 1); u16(channels); u32(rate); u32(rate * channels * width); u16(channels * width); u16(bits);
  if (extensible) { u16(22); u16(bits); u32(0); u16(float ? 3 : 1); o += 14; }
  str('data'); u32(dataSize);
  for (const s of samples) {
    if (float && bits === 32) buf.writeFloatLE(s, o);
    else if (float) buf.writeDoubleLE(s, o);
    else if (bits === 16) buf.writeInt16LE(Math.round(s * 32767), o);
    else if (bits === 24) buf.writeIntLE(Math.round(s * 8388607), o, 3);
    else if (bits === 32) buf.writeInt32LE(Math.round(s * 2147483647), o);
    o += width;
  }
  return buf;
}

const RATE = 8000;
function click(bpm, secs, accentEvery = 0) {
  const out = new Float32Array(Math.round(secs * RATE));
  const period = 60 / bpm;
  for (let i = 0, t = 0; t < secs - 0.1; i++, t = i * period) {
    const big = accentEvery && i % accentEvery === 0;
    const start = Math.round(t * RATE);
    for (let j = 0; j < 80; j++) out[start + j] = (big ? 0.8 : 0.5) * Math.sin((2 * Math.PI * (big ? 2000 : 1500) * j) / RATE) * (1 - j / 80);
  }
  return out;
}

test('reads every common WAV encoding to the same samples', () => {
  const src = [0, 0.5, -0.5, 0.25, -1, 0.999];
  for (const opts of [{ bits: 16 }, { bits: 24 }, { bits: 32 }, { bits: 32, float: true }, { bits: 64, float: true }, { bits: 24, extensible: true }, { bits: 32, float: true, extensible: true }]) {
    const r = readWav(wav(src, opts));
    assert.strictEqual(r.rate, 8000);
    assert.strictEqual(r.channels, 1);
    r.samples.forEach((v, i) => assert.ok(Math.abs(v - src[i]) < 1e-4, `${JSON.stringify(opts)} sample ${i}: ${v}`));
  }
  assert.strictEqual(readWav(wav([])).samples.length, 0, 'an empty file is fine');
});

test('takes an ArrayBuffer as well as a Buffer, and skips chunks it does not need', () => {
  const plain = wav([0.5, -0.5], { channels: 2 });
  // Put a LIST chunk (odd length, so it is padded) between fmt and data.
  const list = Buffer.concat([Buffer.from('LIST'), Buffer.from([3, 0, 0, 0]), Buffer.from('abc'), Buffer.from([0])]);
  const withList = Buffer.concat([plain.subarray(0, 36), list, plain.subarray(36)]);
  const ab = withList.buffer.slice(withList.byteOffset, withList.byteOffset + withList.length);
  const r = readWav(ab);
  assert.strictEqual(r.channels, 2);
  assert.ok(Math.abs(r.samples[0] - 0.5) < 1e-4 && Math.abs(r.samples[1] + 0.5) < 1e-4);
});

test('refuses what it cannot read', () => {
  assert.throws(() => readWav(Buffer.from('not a wav file at all')), /not a WAV/);
  const odd = wav([0, 0], { bits: 16 });
  odd.writeUInt16LE(2, 20); // ADPCM
  assert.throws(() => readWav(odd), /unsupported/);
});

test('reads a click straight from a WAV file, with a tempo from its name', () => {
  const file = wav(click(144, 20));
  assert.strictEqual(analyzeWav(file).bpm, 72);
  assert.strictEqual(analyzeWav(file, ['Click - 144 bpm.wav']).bpm, 144);
  const waltz = analyzeWav(wav(click(120, 20, 3), { bits: 24 }));
  assert.deepStrictEqual([waltz.bpm, waltz.num, waltz.den], [120, 3, 4]);
});

test('the command prints the tempo, and JSON with --json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'click-track-reader-'));
  try {
    const file = path.join(dir, 'Click 100bpm.wav');
    fs.writeFileSync(file, wav(click(100, 20)));
    const bin = path.join(__dirname, '..', 'bin', 'click-track-reader.js');
    const plain = spawnSync(process.execPath, [bin, file], { encoding: 'utf8' });
    assert.strictEqual(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /100 BPM, bar 1 at 0\.000 s, 4\/4 \(assumed\)/);
    const json = spawnSync(process.execPath, [bin, '--json', file], { encoding: 'utf8' });
    assert.strictEqual(JSON.parse(json.stdout).bpm, 100);
    const none = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
    assert.strictEqual(none.status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
