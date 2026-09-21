import React, { useState } from 'react';
import { Radio, Sparkles, Volume2 } from 'lucide-react';

interface AudioConverterControlsProps {
  onConvert: (options: { targetFormat: string; bitrate: string }) => void;
  isProcessing: boolean;
  defaultFormat?: string;
}

export const AudioConverterControls: React.FC<AudioConverterControlsProps> = ({
  onConvert,
  isProcessing,
  defaultFormat = 'mp3',
}) => {
  const [targetFormat, setTargetFormat] = useState(defaultFormat);
  const [bitrate, setBitrate] = useState('320k');

  return (
    <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-cardDark shadow-card space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-brand-500" />
          <span>Audio Conversion Settings</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
          High-Fidelity Client-Side Transcode
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Target Output Format
          </label>
          <select
            value={targetFormat}
            onChange={(e) => setTargetFormat(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="mp3">MP3 (Universal Compatible)</option>
            <option value="wav">WAV (Lossless 16-bit PCM)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Audio Quality (Bitrate)
          </label>
          <select
            value={bitrate}
            onChange={(e) => setBitrate(e.target.value)}
            disabled={targetFormat === 'wav'}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          >
            <option value="320k">320 kbps (Studio Quality)</option>
            <option value="192k">192 kbps (Standard CD)</option>
            <option value="128k">128 kbps (Compact Audio)</option>
          </select>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-brand-800 dark:text-brand-300 flex items-center gap-2.5">
        <Volume2 className="w-4 h-4 text-brand-500 shrink-0" />
        <span>Converts any audio file directly in your browser with pure studio audio fidelity.</span>
      </div>

      <button
        type="button"
        onClick={() => onConvert({ targetFormat, bitrate })}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Convert Audio Now</span>
      </button>
    </div>
  );
};
