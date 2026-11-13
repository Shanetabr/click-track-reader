// Reads a WAV file's bytes into interleaved Float32 samples.
// Handles PCM (8, 16, 24 and 32 bit), IEEE float (32 and 64 bit) and
// WAVE_FORMAT_EXTENSIBLE files of either kind. No dependencies; works on a
// Node Buffer, a Uint8Array or an ArrayBuffer, so it runs in the browser too.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClickTrackWav = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PCM = 1;
  const FLOAT = 3;
  const EXTENSIBLE = 0xfffe;

  function readWav(input) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');

    let fmt = null;
    let data = null;
    for (let at = 12; at + 8 <= bytes.length; ) {
      const id = tag(at);
      const size = view.getUint32(at + 4, true);
      const body = at + 8;
      if (id === 'fmt ') {
        let format = view.getUint16(body, true);
        if (format === EXTENSIBLE && size >= 26) format = view.getUint16(body + 24, true);
        fmt = {
          format,
          channels: view.getUint16(body + 2, true),
          rate: view.getUint32(body + 4, true),
          bits: view.getUint16(body + 14, true),
        };
      } else if (id === 'data') {
        data = { at: body, size: Math.min(size, bytes.length - body) };
      }
      at = body + size + (size & 1);
    }
    if (!fmt) throw new Error('WAV file has no fmt chunk');
    if (!data) throw new Error('WAV file has no data chunk');

    const { format, channels, rate, bits } = fmt;
    const width = bits / 8;
    const count = Math.floor(data.size / width);
    const samples = new Float32Array(count);
    const at = (i) => data.at + i * width;

    if (format === FLOAT && bits === 32) for (let i = 0; i < count; i++) samples[i] = view.getFloat32(at(i), true);
    else if (format === FLOAT && bits === 64) for (let i = 0; i < count; i++) samples[i] = view.getFloat64(at(i), true);
    else if (format === PCM && bits === 8) for (let i = 0; i < count; i++) samples[i] = (bytes[at(i)] - 128) / 128;
    else if (format === PCM && bits === 16) for (let i = 0; i < count; i++) samples[i] = view.getInt16(at(i), true) / 32768;
    else if (format === PCM && bits === 24)
      for (let i = 0; i < count; i++) {
        const p = at(i);
        const v = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
        samples[i] = ((v << 8) >> 8) / 8388608;
      }
    else if (format === PCM && bits === 32) for (let i = 0; i < count; i++) samples[i] = view.getInt32(at(i), true) / 2147483648;
    else throw new Error(`unsupported WAV encoding (format ${format}, ${bits} bit)`);

    return { samples, channels, rate };
  }

  return { readWav };
});
