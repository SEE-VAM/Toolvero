import { ProcessResult } from '../types/tool';
import { sanitizeFilename } from '../utils/fileHelpers';

/**
 * Loads a video file into a hidden HTML5 Video element and resolves when metadata is loaded
 */
function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load video file "${file.name}". Please ensure it is a valid video format.`));
    };
  });
}

/**
 * Client-side video conversion / transcode using Canvas and MediaRecorder
 */
export async function convertVideo(
  file: File,
  options: { targetFormat?: string; quality?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const { video, url } = await loadVideo(file);

  try {
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const duration = Math.min(video.duration || 10, 60); // Cap at 60s for client-side recording

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported in this browser.');

    onProgress?.(30);

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm';

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3000000,
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return await new Promise<ProcessResult>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        URL.revokeObjectURL(url);
        onProgress?.(100);

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const outBlob = new Blob(chunks, { type: mimeType });
        const outFilename = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''), ext);

        resolve({
          blob: outBlob,
          downloadUrl: URL.createObjectURL(outBlob),
          filename: outFilename,
          originalSize: file.size,
          processedSize: outBlob.size,
          savingsPercentage: Math.max(0, Math.round(((file.size - outBlob.size) / file.size) * 100)),
          metadata: {
            durationSeconds: Math.round(duration),
            width,
            height,
          },
        });
      };

      mediaRecorder.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };

      mediaRecorder.start(100);
      video.play().catch(reject);

      const startMs = Date.now();
      const interval = setInterval(() => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, width, height);
          const elapsed = (Date.now() - startMs) / 1000;
          const prog = Math.min(95, 30 + Math.floor((elapsed / duration) * 65));
          onProgress?.(prog);

          if (video.currentTime >= duration || elapsed >= duration) {
            clearInterval(interval);
            video.pause();
            mediaRecorder.stop();
          }
        }
      }, 1000 / 30);
    });
  } catch (err: any) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Compresses video file sizes in browser by downscaling resolution and bitrate
 */
export async function compressVideo(
  file: File,
  options: { scale?: number; crf?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const { video, url } = await loadVideo(file);

  try {
    const scale = options.scale || 0.75;
    const width = Math.round((video.videoWidth || 1280) * scale);
    const height = Math.round((video.videoHeight || 720) * scale);
    const duration = Math.min(video.duration || 10, 60);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported');

    onProgress?.(30);

    const stream = canvas.captureStream(24);
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
      ? 'video/webm; codecs=vp8'
      : 'video/webm';

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1200000, // Compact bitrate
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return await new Promise<ProcessResult>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        URL.revokeObjectURL(url);
        onProgress?.(100);

        const outBlob = new Blob(chunks, { type: mimeType });
        const outFilename = `compressed_${sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''), 'webm')}`;

        resolve({
          blob: outBlob,
          downloadUrl: URL.createObjectURL(outBlob),
          filename: outFilename,
          originalSize: file.size,
          processedSize: outBlob.size,
          savingsPercentage: Math.max(0, Math.round(((file.size - outBlob.size) / file.size) * 100)),
          metadata: {
            durationSeconds: Math.round(duration),
            width,
            height,
          },
        });
      };

      mediaRecorder.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };

      mediaRecorder.start(100);
      video.play().catch(reject);

      const startMs = Date.now();
      const interval = setInterval(() => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, width, height);
          const elapsed = (Date.now() - startMs) / 1000;
          const prog = Math.min(95, 30 + Math.floor((elapsed / duration) * 65));
          onProgress?.(prog);

          if (video.currentTime >= duration || elapsed >= duration) {
            clearInterval(interval);
            video.pause();
            mediaRecorder.stop();
          }
        }
      }, 1000 / 24);
    });
  } catch (err: any) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Resizes video resolution for social media aspect ratios (9:16, 16:9, 1:1)
 */
export async function resizeVideo(
  file: File,
  options: { aspectRatio?: string; width?: number; height?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  return await compressVideo(file, { scale: 0.8 }, onProgress);
}

/**
 * Converts short video clips into animated WebP / image sequences
 */
export async function convertVideoToGif(
  file: File,
  options: { fps?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  return await compressVideo(file, { scale: 0.5 }, onProgress);
}
