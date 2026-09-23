import React, { useState, useRef } from 'react';
import { Layers, Upload, Plus, Trash2, ArrowUp, ArrowDown, FileText, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { mergePdfFiles } from '../../../services/pdfProcessor';
import { formatBytes } from '../../../utils/fileHelpers';
import { ProcessResult } from '../../../types/tool';
import { ProgressBar } from '../ProgressBar';
import { ToastMessage } from '../../common/Toast';

interface MergePdfWorkspaceProps {
  onShowToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const MergePdfWorkspace: React.FC<MergePdfWorkspaceProps> = ({ onShowToast }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (newFileList: FileList | null) => {
    if (!newFileList || newFileList.length === 0) return;

    const validPdfs: File[] = [];
    for (let i = 0; i < newFileList.length; i++) {
      const file = newFileList[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        validPdfs.push(file);
      }
    }

    if (validPdfs.length === 0) {
      onShowToast({
        type: 'error',
        message: 'Please select valid PDF files (.pdf)',
      });
      return;
    }

    setFiles((prev) => [...prev, ...validPdfs]);
    onShowToast({
      type: 'info',
      message: `Added ${validPdfs.length} PDF file${validPdfs.length > 1 ? 's' : ''}`,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      onShowToast({
        type: 'info',
        message: 'Please add at least 2 PDF files to merge.',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(5);

    try {
      const res = await mergePdfFiles(files, (p) => setProgress(p));
      setResult(res);
      setIsProcessing(false);
      onShowToast({
        type: 'success',
        message: `Successfully merged ${files.length} PDF files!`,
      });
    } catch (err: any) {
      setIsProcessing(false);
      onShowToast({
        type: 'error',
        message: err.message || 'Failed to merge PDF files. Please try again.',
      });
    }
  };

  const handleReset = () => {
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    setFiles([]);
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
  };

  // If result is ready, show download screen
  if (result) {
    return (
      <div className="p-8 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-card space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8 shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              PDFs Merged Successfully!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Combined {files.length} PDF files into a single unified document.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                {result.filename}
              </p>
              <p className="text-xs text-slate-500">
                Size: {formatBytes(result.processedSize)} &bull; {result.metadata?.totalPages || 'All'} Pages
              </p>
            </div>
          </div>

          <a
            href={result.downloadUrl}
            download={result.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Merged PDF</span>
          </a>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Merge More Files</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Drop Area */}
      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:border-brand-400 hover:bg-brand-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-100 dark:bg-brand-950/80 text-brand-600 flex items-center justify-center shadow-sm">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Select Multiple PDF Files to Merge
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Drag & drop 2 or more PDF documents here, or click to browse
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all">
            <Upload className="w-4 h-4" />
            <span>Choose PDF Files</span>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-rose-500" />
                <span>Selected Files for Merging ({files.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rearrange files using the arrows to adjust the merge order
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={appendInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => appendInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More PDFs</span>
              </button>
              <button
                type="button"
                onClick={() => setFiles([])}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Files List */}
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || isProcessing}
                    title="Move Up"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === files.length - 1 || isProcessing}
                    title="Move Down"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={isProcessing}
                    title="Remove"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Progress */}
          {isProcessing && (
            <div className="pt-2">
              <ProgressBar progress={progress} label="Merging PDF documents in your browser..." />
            </div>
          )}

          {/* Action Button */}
          {!isProcessing && (
            <button
              onClick={handleMerge}
              disabled={files.length < 2}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Layers className="w-5 h-5" />
              <span>
                {files.length < 2
                  ? 'Add at least 2 PDF files to Merge'
                  : `Merge ${files.length} PDFs into One Document`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
