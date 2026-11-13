export type Samples = Float32Array | Int16Array | ArrayLike<number>;

export interface Tick {
  /** Seconds from the start of the audio. */
  t: number;
  /** Peak level, 0 to 1 of the loudest tick. */
  p: number;
  /** Rough pitch of the tick, from zero crossings. */
  hz: number;
}

export interface ClickResult {
  /** Tempo in quarter notes per minute, between 70 and 140 unless a name hint says otherwise. */
  bpm: number;
  /** Seconds to the first tick, taken as bar 1. */
  offset: number;
  /** Time signature numerator. */
  num: number;
  /** Time signature denominator. */
  den: number;
  /** Ticks per minute, unrounded. */
  perMinute: number;
  /** Number of ticks found. */
  count: number;
  /** False when the tempo changes partway through. */
  steady: boolean;
  /** Seconds where the tempo changes. */
  changes: number[];
  /** 'heard' when the accents gave the signature, 'assumed' when 4/4 was a guess. */
  signature: 'heard' | 'assumed';
}

/** Reads click samples (interleaved when channels > 1). Returns null when the audio is not a click. */
export function analyze(samples: Samples, channels: number, rate: number, hint?: number): ClickResult | null;

/** Reads a click straight from a WAV file's bytes. `names` are file or folder names to look for a tempo in. */
export function analyzeWav(bytes: Uint8Array | ArrayBuffer, names?: string[]): ClickResult | null;

/** Every tick in the audio. */
export function ticks(samples: Samples, channels: number, rate: number): Tick[];

/** A tempo written in a file or folder name ("Song-127.00bpm"), or 0. */
export function hintFrom(names: string[]): number;

/** Decodes a WAV file into interleaved Float32 samples. */
export function readWav(bytes: Uint8Array | ArrayBuffer): { samples: Float32Array; channels: number; rate: number };
