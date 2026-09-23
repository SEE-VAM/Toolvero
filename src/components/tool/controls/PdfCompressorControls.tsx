import React, { useState } from 'react';
import { Minimize2, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface PdfCompressorControlsProps {
  onCompress: (options: { level: 'recommended' | 'extreme' | 'low' }) => void;
  isProcessing: boolean;
}

export const PdfCompressorControls: React.FC<PdfCompressorControlsProps> = ({
  onCompress,
  isProcessing,
}) => {
  const [level, setLevel] = useState<'recommended' | 'extreme' | 'low'>('recommended');

  const presets = [
    {
      id: 'recommended',
      title: 'Recommended Compression',
      desc: 'Optimized balance. Reduces size by ~50% to 75% while keeping text and photos crisp.',
      badge: 'Popular (Balanced)',
      reduction: '~60% Smaller',
    },
    {
      id: 'extreme',
      title: 'Extreme Compression',
      desc: 'Maximum file size reduction. Reduces size by ~75% to 90%. Best for email and portal limits.',
      badge: 'Smallest File Size',
      reduction: '~80% Smaller',
    },
    {
      id: 'low',
      title: 'Low Compression',
      desc: 'Gentle compression. Reduces size by ~25% to 40% preserving maximum print fidelity.',
      badge: 'Highest Quality',
      reduction: '~35% Smaller',
    },
  ];

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <Minimize2 className="w-4 h-4 text-brand-500" />
        <span>Select PDF Compression Level</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const isSelected = level === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setLevel(preset.id as any)}
              className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/60 ring-2 ring-brand-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {preset.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[34px]">
                {preset.desc}
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                  isSelected
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {preset.badge}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {preset.reduction}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
        <Zap className="w-4 h-4 shrink-0 text-blue-500" />
        <span>100% In-Browser Compression: Optimizes image streams and document objects right on your device.</span>
      </div>

      <button
        onClick={() => onCompress({ level })}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>
          {level === 'extreme'
            ? 'Compress PDF (Extreme - Maximum Reduction)'
            : level === 'low'
            ? 'Compress PDF (Low - Maximum Quality)'
            : 'Compress PDF (Recommended - Balanced)'}
        </span>
      </button>
    </div>
  );
};
