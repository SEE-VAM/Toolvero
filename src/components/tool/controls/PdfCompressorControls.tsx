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
      desc: 'Optimized balance of smaller file size and clear document readability.',
      badge: 'Popular',
    },
    {
      id: 'extreme',
      title: 'Extreme Compression',
      desc: 'Maximum file size reduction. Best for portals with strict upload limits.',
      badge: 'Smallest Size',
    },
    {
      id: 'low',
      title: 'Low Compression',
      desc: 'Gentle stream optimization preserving maximum print fidelity.',
      badge: 'Highest Quality',
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
                  ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-950/60 ring-2 ring-brand-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {preset.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {preset.desc}
              </p>
              <span className={`inline-block mt-2.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                isSelected
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {preset.badge}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
        <Zap className="w-4 h-4 shrink-0 text-blue-500" />
        <span>100% In-Browser Compression: Your document is never uploaded to any server.</span>
      </div>

      <button
        onClick={() => onCompress({ level })}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Compress PDF</span>
      </button>
    </div>
  );
};
