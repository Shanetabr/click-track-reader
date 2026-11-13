'use strict';
const { ticks, analyze, hintFrom } = require('./src/clicktrack');
const { readWav } = require('./src/wav');

// Reads a click stem straight from a WAV file's bytes. `names` are file or
// folder names to look for a tempo in ("Song - 127.00bpm"), which decides
// whether the ticks are eighths or quarters when the audio cannot.
function analyzeWav(bytes, names = []) {
  const { samples, channels, rate } = readWav(bytes);
  return analyze(samples, channels, rate, hintFrom(names));
}

module.exports = { analyze, analyzeWav, ticks, hintFrom, readWav };
