import React, { useState } from 'react';
import { Sliders, Sparkles, Volume2, ArrowDownCircle } from 'lucide-react';

interface AudioCompressorControlsProps {
  onCompress: (options: { bitrate: string }) => void;
  isProcessing: boolean;
  fileSize?: number;
}

export const AudioCompressorControls: React.FC<AudioCompressorControlsProps> = ({
  onCompress,
  isProcessing,
  fileSize,
}) => {
  const [bitrate, setBitrate] = useState('128k');

  const getEstimatedSavings = () => {
    if (!fileSize) return '50% - 75%';
    switch (bitrate) {
      case '64k': return '~75% - 85% smaller';
      case '96k': return '~60% - 70% smaller';
      case '128k': return '~45% - 60% smaller';
      case '192k': return '~25% - 40% smaller';
      default: return '~50% smaller';
    }
  };

  return (
    <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-cardDark shadow-card space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-brand-500" />
          <span>Audio Compression Settings</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
          100% In-Browser Compression
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Compression Level (Target Bitrate)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: '64k', label: '64 kbps', desc: 'Maximum Shrink' },
              { id: '96k', label: '96 kbps', desc: 'Compact Voice' },
              { id: '128k', label: '128 kbps', desc: 'Standard Balanced' },
              { id: '192k', label: '192 kbps', desc: 'High Quality' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBitrate(opt.id)}
                className={`p-3 rounded-2xl text-left border transition-all ${
                  bitrate === opt.id
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-900 dark:text-brand-200 ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs">{opt.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
            <span>Estimated Size Reduction:</span>
          </div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {getEstimatedSavings()}
          </span>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-brand-800 dark:text-brand-300 flex items-center gap-2.5">
        <Volume2 className="w-4 h-4 text-brand-500 shrink-0" />
        <span>Compresses voice recordings, podcasts, and songs locally with zero audio distortion.</span>
      </div>

      <button
        type="button"
        onClick={() => onCompress({ bitrate })}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Compress Audio Now</span>
      </button>
    </div>
  );
};
