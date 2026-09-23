import React, { useState, useEffect } from 'react';
import { FileImage, Sparkles } from 'lucide-react';
import { getPdfPageCount } from '../../../services/pdfProcessor';

interface PdfToJpgControlsProps {
  file: File;
  onConvert: (options: { pageNumber: number; dpi: number; quality: number }) => void;
  isProcessing: boolean;
}

export const PdfToJpgControls: React.FC<PdfToJpgControlsProps> = ({
  file,
  onConvert,
  isProcessing,
}) => {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(90);

  useEffect(() => {
    let isMounted = true;
    getPdfPageCount(file).then((count) => {
      if (isMounted) {
        setTotalPages(count);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [file]);

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-2">
          <FileImage className="w-4 h-4 text-brand-500" />
          <span>PDF to JPG Converter Settings</span>
        </div>
        {totalPages !== null && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            {totalPages} Total {totalPages === 1 ? 'Page' : 'Pages'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Page Number to Convert
          </label>
          <input
            type="number"
            min={1}
            max={totalPages || 999}
            value={pageNumber}
            onChange={(e) => setPageNumber(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Output Resolution (DPI)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDpi(150)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                dpi === 150
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              150 DPI (Fast)
            </button>
            <button
              type="button"
              onClick={() => setDpi(300)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                dpi === 300
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              300 DPI (Ultra Sharp)
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => onConvert({ pageNumber, dpi, quality })}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>Convert Page to JPG</span>
      </button>
    </div>
  );
};
