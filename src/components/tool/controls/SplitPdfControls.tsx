import React, { useState, useEffect } from 'react';
import { Scissors, FileText, Sparkles, HelpCircle } from 'lucide-react';
import { getPdfPageCount } from '../../../services/pdfProcessor';

interface SplitPdfControlsProps {
  file: File;
  onSplit: (options: { pageRanges: string }) => void;
  isProcessing: boolean;
}

export const SplitPdfControls: React.FC<SplitPdfControlsProps> = ({
  file,
  onSplit,
  isProcessing,
}) => {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [pageRanges, setPageRanges] = useState('1');

  useEffect(() => {
    let isMounted = true;
    getPdfPageCount(file).then((count) => {
      if (isMounted) {
        setTotalPages(count);
        if (count > 1) {
          setPageRanges(`1-${Math.min(count, 3)}`);
        } else {
          setPageRanges('1');
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [file]);

  const applyPreset = (preset: string) => {
    setPageRanges(preset);
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-brand-500" />
          <span>Split PDF / Page Extraction</span>
        </div>
        {totalPages !== null && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            {totalPages} Total {totalPages === 1 ? 'Page' : 'Pages'}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Pages to Extract
          </label>
          <div className="relative">
            <input
              type="text"
              value={pageRanges}
              onChange={(e) => setPageRanges(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Enter page numbers or ranges separated by commas (e.g. 1-3, 5, 8).</span>
          </p>
        </div>

        {totalPages !== null && totalPages > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-slate-500 self-center mr-1">Quick Select:</span>
            <button
              type="button"
              onClick={() => applyPreset('1')}
              className="py-1 px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              Page 1 Only
            </button>
            <button
              type="button"
              onClick={() => applyPreset(`1-${Math.min(totalPages, 3)}`)}
              className="py-1 px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              First {Math.min(totalPages, 3)} Pages
            </button>
            <button
              type="button"
              onClick={() => applyPreset(`1-${totalPages}`)}
              className="py-1 px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              All Pages (1-{totalPages})
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => onSplit({ pageRanges })}
        disabled={isProcessing || !pageRanges.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Extract & Split PDF</span>
      </button>
    </div>
  );
};
