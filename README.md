# click-track-reader

[![npm](https://img.shields.io/npm/v/click-track-reader)](https://www.npmjs.com/package/click-track-reader)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Read a recorded click track and get its **exact tempo**, **where bar 1
starts**, and, when the accents give it away, the **time signature**.

Multitrack stems for live shows almost always come with a click track. It's
the cleanest thing in the song to measure: short hits with silence between
them. General-purpose BPM detectors listen to the whole mix and guess; this
reads the click tick by tick and measures from the first tick to the last, so
the tempo is exact to a hundredth of a BPM on a steady click.

- Zero dependencies. Node 18+, and the core also runs in the browser.
- Reads WAV files (PCM 8/16/24/32-bit, float 32/64-bit, extensible).
- Finds tempo changes and tells you where they are instead of averaging them away.
- Handles rests in the click, silence before the first tick, mono and stereo.
- Says when audio is *not* a click, instead of making up a tempo.

Pulled out of [Selah](https://github.com/Shanetabr/selah), a multitrack
playback app for live shows, where it sets up a song's tempo grid from its
click stem.

## Command line

```sh
npx click-track-reader "Click Track.wav"
```

```
Click Track.wav: 127 BPM, bar 1 at 0.000 s, 4/4 (assumed), 1340 ticks
```

Pass several files at once, or `--json` for one JSON object per file.

## In code

```js
const fs = require('fs');
const { analyzeWav } = require('click-track-reader');

const result = analyzeWav(fs.readFileSync('Click Track.wav'), ['Song - 127.00bpm']);
// {
//   bpm: 127,            quarter notes per minute
//   offset: 0,           seconds to bar 1 (the first tick)
//   num: 4, den: 4,      time signature
//   signature: 'assumed' 'heard' when the accents gave it, 'assumed' for 4/4 by default
//   steady: true,        false if the tempo changes
//   changes: [],         seconds where it changes
//   perMinute: 254.0,    raw ticks per minute
//   count: 1340          ticks found
// }
```

Already have decoded audio (from Web Audio, ffmpeg, etc.)? Skip the WAV step:

```js
const { analyze } = require('click-track-reader');
analyze(samples, channels, sampleRate, hintBpm); // samples: Float32Array or Int16Array, interleaved
```

`ticks(samples, channels, sampleRate)` returns every tick with its time,
level and rough pitch, if you want to do your own analysis. `readWav(bytes)`
is the WAV decoder on its own.

## How it decides

**Which tick is the beat.** Ticks alone can't say whether 254 ticks a minute
is eighth notes at 127 or quarters at 254. The tempo is taken between 70 and
140 BPM unless a tempo in a file or folder name (`"139 bpm"`, `"127.00bpm"`)
says otherwise. `analyzeWav` looks at the names you pass; the command line
passes the file's name and its folder's.

**Bar 1** is the first tick. A count-in in the click counts as part of the
song; trim it or subtract it if you need to.

**Time signature.** When some ticks are louder or higher than the rest, the
distance between them gives 3/4 (three beats) or 6/8 (three eighths).
Anything else is reported as 4/4 with `signature: 'assumed'`.

**Tempo changes.** A gap that isn't a whole number of ticks starts a new
tempo. The result has `steady: false` and the times in `changes`; the BPM is
then taken from the median gap between ticks.

## Limits

- One tempo grid per call; a click that changes tempo is flagged, not mapped.
- Odd meters (5/4, 7/8) come out as 4/4 *assumed*.
- WAV only for the built-in decoder. Decode MP3, AIFF and others yourself and
  call `analyze`.

## License

MIT
