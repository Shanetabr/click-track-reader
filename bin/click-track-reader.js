#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { analyzeWav } = require('..');

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => a !== '--json');

if (!files.length || args.includes('-h') || args.includes('--help')) {
  console.log('Usage: click-track-reader [--json] <click.wav> [more.wav ...]');
  console.log('Reads a recorded click stem and prints its tempo, bar 1 and time signature.');
  process.exit(files.length ? 0 : 1);
}

let failed = false;
for (const file of files) {
  let result;
  try {
    const full = path.resolve(file);
    result = analyzeWav(fs.readFileSync(full), [path.basename(full), path.basename(path.dirname(full))]);
  } catch (err) {
    console.error(`${file}: ${err.message}`);
    failed = true;
    continue;
  }
  if (json) {
    console.log(JSON.stringify({ file, ...result }));
  } else if (!result) {
    console.log(`${file}: not a click track`);
    failed = true;
  } else {
    const sig = `${result.num}/${result.den}${result.signature === 'assumed' ? ' (assumed)' : ''}`;
    const tempo = result.steady ? '' : `, tempo changes at ${result.changes.map((t) => t.toFixed(2) + ' s').join(', ')}`;
    console.log(`${file}: ${result.bpm} BPM, bar 1 at ${result.offset.toFixed(3)} s, ${sig}, ${result.count} ticks${tempo}`);
  }
}
process.exit(failed ? 1 : 0);
