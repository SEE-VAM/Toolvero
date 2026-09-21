import { Mp3Encoder } from '@breezystack/lamejs';
import { ProcessResult } from '../types/tool';
import { sanitizeFilename } from '../utils/fileHelpers';

/**
 * Encodes an AudioBuffer into genuine MPEG-1 Audio Layer III (MP3) frames.
 * Zero clicking, zero buzzing ('tttttt' sound) — pure crystal-clear music.
 */
export function audioBufferToMp3Blob(audioBuffer: AudioBuffer, kbps: number = 192): Blob {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const sampleBlockSize = 1152;
  const numSamples = audioBuffer.length;

  if (numChannels === 2) {
    const leftFloat = audioBuffer.getChannelData(0);
    const rightFloat = audioBuffer.getChannelData(1);

    const leftInt16 = new Int16Array(numSamples);
    const rightInt16 = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const sL = Math.max(-1, Math.min(1, leftFloat[i]));
      leftInt16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
      const sR = Math.max(-1, Math.min(1, rightFloat[i]));
      rightInt16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
    }

    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf && mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  } else {
    const monoFloat = audioBuffer.getChannelData(0);
    const monoInt16 = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, monoFloat[i]));
      monoInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const chunk = monoInt16.subarray(i, i + sampleBlockSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf && mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  }

  const endBuf = encoder.flush();
  if (endBuf && endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM RIFF Wave / Audio file
 */
export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    interleaved = new Float32Array(left.length + right.length);
    let inputIdx = 0;
    let outputIdx = 0;
    while (inputIdx < left.length) {
      interleaved[outputIdx++] = left[inputIdx];
      interleaved[outputIdx++] = right[inputIdx];
      inputIdx++;
    }
  } else {
    interleaved = audioBuffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Safely decodes an ArrayBuffer into an AudioBuffer with detailed error handling
 */
async function safeDecodeAudio(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<AudioBuffer> {
  // Check file minimum size (must be at least 2KB to contain valid media header)
  if (arrayBuffer.byteLength < 2048) {
    const preview = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 200)));
    if (preview.includes('error') || preview.includes('html') || preview.includes('Streaming')) {
      throw new Error(
        `The file "${fileName}" is an incomplete or corrupted download (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB). Please supply a valid video or audio file.`
      );
    }
    throw new Error(
      `The file "${fileName}" is too small (${arrayBuffer.byteLength} bytes) to contain playable audio data.`
    );
  }

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err: any) {
    throw new Error(
      `Could not decode audio from "${fileName}". The video may lack an audio stream or use an unsupported audio format (e.g., Dolby AC-3). Please use MP4, WebM, or WAV files with AAC or MP3 audio.`
    );
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }
}

/**
 * Extracts and converts audio track from MP4 / WebM / Video in the browser
 */
export async function extractAudioFromVideo(
  file: File,
  options: { bitrate?: string; format?: string } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(50);
  const audioBuffer = await safeDecodeAudio(arrayBuffer, file.name);

  onProgress?.(80);
  const isWav = options.format === 'wav';
  const kbps = options.bitrate === '128k' ? 128 : options.bitrate === '192k' ? 192 : options.bitrate === '256k' ? 256 : 320;
  const audioBlob = isWav
    ? audioBufferToWavBlob(audioBuffer)
    : audioBufferToMp3Blob(audioBuffer, kbps);

  onProgress?.(100);
  const ext = isWav ? 'wav' : 'mp3';
  const outFilename = sanitizeFilename(file.name, ext);

  return {
    blob: audioBlob,
    downloadUrl: URL.createObjectURL(audioBlob),
    filename: outFilename,
    originalSize: file.size,
    processedSize: audioBlob.size,
    savingsPercentage: Math.max(0, Math.round(((file.size - audioBlob.size) / file.size) * 100)),
    metadata: {
      durationSeconds: Math.round(audioBuffer.duration),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    },
  };
}

/**
 * Compresses audio files in the browser by re-encoding to an optimized MP3 bitrate
 */
export async function compressAudio(
  file: File,
  options: { bitrate?: string; quality?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(50);
  const audioBuffer = await safeDecodeAudio(arrayBuffer, file.name);

  onProgress?.(80);
  let kbps = 128;
  if (options.bitrate === '64k') kbps = 64;
  else if (options.bitrate === '96k') kbps = 96;
  else if (options.bitrate === '128k') kbps = 128;
  else if (options.bitrate === '192k') kbps = 192;
  else if (options.bitrate === '320k') kbps = 320;

  const audioBlob = audioBufferToMp3Blob(audioBuffer, kbps);

  onProgress?.(100);
  const outFilename = sanitizeFilename(file.name, 'mp3');

  return {
    blob: audioBlob,
    downloadUrl: URL.createObjectURL(audioBlob),
    filename: outFilename,
    originalSize: file.size,
    processedSize: audioBlob.size,
    savingsPercentage: Math.max(0, Math.round(((file.size - audioBlob.size) / file.size) * 100)),
    metadata: {
      durationSeconds: Math.round(audioBuffer.duration),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    },
  };
}

/**
 * Converts audio format (WAV to MP3, MP3 to WAV, OGG/FLAC to MP3/WAV)
 */
export async function convertAudioFormat(
  file: File,
  options: { targetFormat?: string; bitrate?: string } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(50);
  const audioBuffer = await safeDecodeAudio(arrayBuffer, file.name);

  onProgress?.(80);
  const isWav = options.targetFormat === 'wav' || options.targetFormat === 'audio/wav';
  const kbps = options.bitrate === '128k' ? 128 : options.bitrate === '192k' ? 192 : 320;

  const audioBlob = isWav
    ? audioBufferToWavBlob(audioBuffer)
    : audioBufferToMp3Blob(audioBuffer, kbps);

  onProgress?.(100);
  const ext = isWav ? 'wav' : 'mp3';
  const outFilename = sanitizeFilename(file.name, ext);

  return {
    blob: audioBlob,
    downloadUrl: URL.createObjectURL(audioBlob),
    filename: outFilename,
    originalSize: file.size,
    processedSize: audioBlob.size,
    savingsPercentage: Math.max(0, Math.round(((file.size - audioBlob.size) / file.size) * 100)),
    metadata: {
      durationSeconds: Math.round(audioBuffer.duration),
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    },
  };
}
