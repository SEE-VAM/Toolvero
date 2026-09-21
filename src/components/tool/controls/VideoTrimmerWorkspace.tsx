import React, { useState, useRef, useEffect } from 'react';
import { Scissors, Play, Pause, Download, Sparkles, Film, RefreshCw } from 'lucide-react';
import { sanitizeFilename } from '../../../utils/fileHelpers';

interface VideoTrimmerWorkspaceProps {
  onShowToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

export const VideoTrimmerWorkspace: React.FC<VideoTrimmerWorkspaceProps> = ({ onShowToast }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      setStartTime(0);
      setCurrentTime(0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setEndTime(Math.min(dur, 10));
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);
    if (cur >= endTime && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = startTime;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // Perform client-side video trimming using Canvas & MediaRecorder
  const handleTrimVideo = async () => {
    if (!videoRef.current || !videoFile) return;

    setIsTrimming(true);
    setTrimProgress(10);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas 2D context not supported');

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const trimDuration = endTime - startTime;
      video.currentTime = startTime;
      await new Promise((r) => setTimeout(r, 200));

      mediaRecorder.start(100);
      await video.play();

      const startTimeMs = Date.now();
      const interval = setInterval(() => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const elapsed = (Date.now() - startTimeMs) / 1000;
          const prog = Math.min(90, Math.floor((elapsed / trimDuration) * 80) + 10);
          setTrimProgress(prog);

          if (video.currentTime >= endTime || elapsed >= trimDuration) {
            clearInterval(interval);
            video.pause();
            mediaRecorder.stop();
          }
        }
      }, 1000 / 30);

      mediaRecorder.onstop = () => {
        clearInterval(interval);
        setTrimProgress(100);
        const trimmedBlob = new Blob(chunks, { type: 'video/webm' });
        const outUrl = URL.createObjectURL(trimmedBlob);
        const a = document.createElement('a');
        a.href = outUrl;
        a.download = sanitizeFilename(videoFile.name.replace(/\.[^/.]+$/, ''), 'webm');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(outUrl), 5000);

        setIsTrimming(false);
        setTrimProgress(0);
        onShowToast({
          type: 'success',
          message: 'Trimmed video downloaded successfully!',
        });
      };
    } catch (err: any) {
      setIsTrimming(false);
      setTrimProgress(0);
      onShowToast({
        type: 'error',
        message: err.message || 'Failed to trim video in browser.',
      });
    }
  };

  return (
    <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-cardDark shadow-card space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-brand-500" />
          <span>Interactive Video Trimmer</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
          100% In-Browser Trimming
        </span>
      </div>

      {!videoFile ? (
        <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-500 dark:hover:border-brand-400 bg-slate-50/50 dark:bg-slate-800/30 transition-all">
          <Film className="w-10 h-10 text-slate-400" />
          <div className="text-center">
            <span className="text-sm font-bold text-brand-600 dark:text-brand-400">Click to upload video</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">Supports MP4, WebM, MOV</span>
          </div>
          <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-6">
          {/* Video Player */}
          <div className="rounded-2xl overflow-hidden bg-black aspect-video max-h-[400px] flex items-center justify-center relative shadow-inner">
            <video
              ref={videoRef}
              src={videoUrl || undefined}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Player Controls & Scrubber */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
              <span>Start: {formatTime(startTime)}</span>
              <span className="text-brand-600 dark:text-brand-400">Current: {formatTime(currentTime)}</span>
              <span>End: {formatTime(endTime)}</span>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Cut Point (Seconds)
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, endTime - 0.5)}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setStartTime(val);
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-brand-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Cut Point (Seconds)
                </label>
                <input
                  type="range"
                  min={startTime + 0.5}
                  max={duration || 10}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEndTime(val);
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-brand-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause Preview' : 'Preview Selection'}</span>
              </button>

              <div className="text-xs text-slate-500 font-medium">
                Trimmed Length: <span className="font-bold text-slate-800 dark:text-slate-200">{(endTime - startTime).toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isTrimming && (
            <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/80">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200 mb-2">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600 dark:text-brand-400" />
                  Rendering trimmed video...
                </span>
                <span>{trimProgress}%</span>
              </div>
              <div className="w-full h-2 bg-brand-200 dark:bg-brand-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 dark:bg-brand-400 rounded-full transition-all duration-200"
                  style={{ width: `${trimProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTrimVideo}
              disabled={isTrimming}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Scissors className="w-4 h-4" />
              <span>Cut &amp; Download Video</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (videoUrl) URL.revokeObjectURL(videoUrl);
                setVideoFile(null);
                setVideoUrl(null);
              }}
              className="px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
            >
              Choose Other Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
