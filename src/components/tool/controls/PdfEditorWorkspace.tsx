import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  Type,
  Eraser,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Upload,
  FileText,
  Bold,
  Italic,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import {
  loadPdfPageForEditing,
  exportEditedPdf,
  DetectedTextItem,
  CustomTextBox,
  WhiteoutBox,
  PageEdits,
} from '../../../services/pdfProcessor';
import { ProcessResult } from '../../../types/tool';
import { formatBytes } from '../../../utils/fileHelpers';
import { ProgressBar } from '../ProgressBar';
import { ToastMessage } from '../../common/Toast';

interface PdfEditorWorkspaceProps {
  onShowToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

type EditorMode = 'edit-text' | 'add-text' | 'whiteout';

export const PdfEditorWorkspace: React.FC<PdfEditorWorkspaceProps> = ({ onShowToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);

  // Active Tool Mode
  const [mode, setMode] = useState<EditorMode>('edit-text');

  // Page background image and extracted text
  const [pageDataUrl, setPageDataUrl] = useState<string>('');
  const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1100 });

  // Stored items and edits per page
  const [pageItemsMap, setPageItemsMap] = useState<Record<number, DetectedTextItem[]>>({});
  const [allEdits, setAllEdits] = useState<Record<number, PageEdits>>({});

  // Active editing text item
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // New text styling toolbar state
  const [selectedFont, setSelectedFont] = useState<'sans-serif' | 'serif' | 'monospace'>('sans-serif');
  const [selectedFontSize, setSelectedFontSize] = useState<number>(14);
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Processing & Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentContainerRef = useRef<HTMLDivElement>(null);

  // Load page data whenever currentPage or file changes
  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    setIsLoadingPage(true);

    loadPdfPageForEditing(file, currentPage, 1.5)
      .then((data) => {
        if (!isMounted) return;
        setPageDataUrl(data.canvasDataUrl);
        setPageDimensions({ width: data.width, height: data.height });
        setNumPages(data.numPages);

        setPageItemsMap((prev) => ({
          ...prev,
          [currentPage]: data.textItems,
        }));
        setIsLoadingPage(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load page for editing:', err);
        setIsLoadingPage(false);
        onShowToast({
          type: 'error',
          message: 'Failed to load PDF page for editing.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [file, currentPage]);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      onShowToast({
        type: 'error',
        message: 'Please select a valid PDF document (.pdf)',
      });
      return;
    }
    setFile(selectedFile);
    setCurrentPage(1);
    setAllEdits({});
    setPageItemsMap({});
    setResult(null);
    onShowToast({
      type: 'info',
      message: `Opened "${selectedFile.name}". Click any text to edit!`,
    });
  };

  // Current page edits helper
  const currentPageEdits: PageEdits = allEdits[currentPage] || {
    editedItems: {},
    customBoxes: [],
    whiteouts: [],
  };

  const currentTextItems = pageItemsMap[currentPage] || [];

  // Update existing text item
  const handleTextChange = (itemId: string, newText: string) => {
    setAllEdits((prev) => {
      const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
      return {
        ...prev,
        [currentPage]: {
          ...pageEdit,
          editedItems: {
            ...pageEdit.editedItems,
            [itemId]: newText,
          },
        },
      };
    });
  };

  // Click on canvas container to add text or whiteout
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!documentContainerRef.current) return;
    const rect = documentContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    if (mode === 'add-text') {
      const newBox: CustomTextBox = {
        id: `custom_${Date.now()}`,
        text: 'New Text',
        xPercent,
        yPercent,
        fontSize: selectedFontSize,
        fontFamily: selectedFont,
        color: selectedColor,
        isBold,
        isItalic,
      };

      setAllEdits((prev) => {
        const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
        return {
          ...prev,
          [currentPage]: {
            ...pageEdit,
            customBoxes: [...pageEdit.customBoxes, newBox],
          },
        };
      });

      onShowToast({
        type: 'info',
        message: 'Added new text box. Type your text directly into it!',
      });
    } else if (mode === 'whiteout') {
      const newWhiteout: WhiteoutBox = {
        id: `whiteout_${Date.now()}`,
        xPercent: Math.max(0, xPercent - 5),
        yPercent: Math.max(0, yPercent - 2),
        widthPercent: 12,
        heightPercent: 4,
      };

      setAllEdits((prev) => {
        const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
        return {
          ...prev,
          [currentPage]: {
            ...pageEdit,
            whiteouts: [...pageEdit.whiteouts, newWhiteout],
          },
        };
      });

      onShowToast({
        type: 'info',
        message: 'Added whiteout eraser box.',
      });
    }
  };

  // Delete custom text box
  const removeCustomBox = (boxId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllEdits((prev) => {
      const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
      return {
        ...prev,
        [currentPage]: {
          ...pageEdit,
          customBoxes: pageEdit.customBoxes.filter((b) => b.id !== boxId),
        },
      };
    });
  };

  // Delete whiteout
  const removeWhiteout = (whiteoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllEdits((prev) => {
      const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
      return {
        ...prev,
        [currentPage]: {
          ...pageEdit,
          whiteouts: pageEdit.whiteouts.filter((w) => w.id !== whiteoutId),
        },
      };
    });
  };

  // Reset page edits
  const handleResetCurrentPage = () => {
    setAllEdits((prev) => ({
      ...prev,
      [currentPage]: { editedItems: {}, customBoxes: [], whiteouts: [] },
    }));
    setActiveItemId(null);
    onShowToast({
      type: 'info',
      message: `Cleared all edits on page ${currentPage}.`,
    });
  };

  // Export Edited PDF
  const handleExport = async () => {
    if (!file) return;

    setIsExporting(true);
    setExportProgress(5);

    try {
      const res = await exportEditedPdf(file, allEdits, pageItemsMap, (p) => setExportProgress(p));
      setResult(res);
      setIsExporting(false);
      onShowToast({
        type: 'success',
        message: 'Edited PDF generated successfully!',
      });
    } catch (err: any) {
      console.error('Failed to export edited PDF:', err);
      setIsExporting(false);
      onShowToast({
        type: 'error',
        message: err.message || 'Failed to export edited PDF.',
      });
    }
  };

  const handleReset = () => {
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    setFile(null);
    setResult(null);
    setCurrentPage(1);
    setAllEdits({});
    setPageItemsMap({});
  };

  // Success Result Screen
  if (result) {
    return (
      <div className="p-8 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-card space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8 shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              PDF Edited & Exported Successfully!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All text changes, replacements, and additions were seamlessly compiled with matching fonts.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                {result.filename}
              </p>
              <p className="text-xs text-slate-500">
                Size: {formatBytes(result.processedSize)} &bull; {numPages} Total Pages
              </p>
            </div>
          </div>

          <a
            href={result.downloadUrl}
            download={result.filename}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Edited PDF</span>
          </a>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Edit Another PDF Document</span>
          </button>
        </div>
      </div>
    );
  }

  // Upload Screen
  if (!file) {
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-400 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-brand-50/20 rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
          className="hidden"
        />
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-100 dark:bg-brand-950/80 text-brand-600 flex items-center justify-center shadow-sm">
          <Edit3 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Select Any PDF Document to Edit
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Click on any line or word to change text in the original matching font, add new text, or erase sections. 100% in-browser privacy.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition-all">
          <Upload className="w-4 h-4" />
          <span>Upload PDF File</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Main Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Mode Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setMode('edit-text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'edit-text'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Text (In Font)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('add-text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'add-text'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Add Text</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('whiteout')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'whiteout'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Whiteout Eraser</span>
          </button>
        </div>

        {/* Styling controls (for added text or font overrides) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Font Family */}
          <select
            value={selectedFont}
            onChange={(e) => setSelectedFont(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="sans-serif">Sans-Serif (Arial / Helvetica)</option>
            <option value="serif">Serif (Times New Roman)</option>
            <option value="monospace">Monospace (Courier)</option>
          </select>

          {/* Font Size */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSelectedFontSize((s) => Math.max(8, s - 1))}
              className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              -
            </button>
            <span className="px-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              {selectedFontSize}px
            </span>
            <button
              type="button"
              onClick={() => setSelectedFontSize((s) => Math.min(48, s + 1))}
              className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              +
            </button>
          </div>

          {/* Color Picker */}
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            title="Text Color"
            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-white"
          />

          {/* Bold Toggle */}
          <button
            type="button"
            onClick={() => setIsBold(!isBold)}
            className={`p-1.5 rounded-lg border text-xs ${
              isBold
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-600'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic Toggle */}
          <button
            type="button"
            onClick={() => setIsItalic(!isItalic)}
            className={`p-1.5 rounded-lg border text-xs ${
              isItalic
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-600'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Nav & Zoom */}
        <div className="flex items-center gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoadingPage}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= numPages || isLoadingPage}
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="p-1 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Reset Page Edits */}
          <button
            type="button"
            onClick={handleResetCurrentPage}
            title="Reset current page edits"
            className="p-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Download Action Button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Download Edited PDF</span>
          </button>
        </div>
      </div>

      {/* Helpful banner for user */}
      <div className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 shrink-0 text-blue-500" />
          <span>
            {mode === 'edit-text'
              ? 'Click directly on any line or word below to edit its text in the original matching font.'
              : mode === 'add-text'
              ? 'Click anywhere on the document to insert a new text box.'
              : 'Click on any part of the document to place a whiteout box (eraser).'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          File: {file.name}
        </span>
      </div>

      {/* Export progress bar */}
      {isExporting && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <ProgressBar progress={exportProgress} label="Compiling all edited pages with matching typography..." />
        </div>
      )}

      {/* Document Viewport */}
      <div className="p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-x-auto flex justify-center min-h-[600px] relative">
        {isLoadingPage && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading Page {currentPage}...</span>
            </div>
          </div>
        )}

        {pageDataUrl && (
          <div
            ref={documentContainerRef}
            onClick={handleContainerClick}
            className="relative shadow-2xl rounded-lg bg-white overflow-hidden select-none"
            style={{
              width: `${pageDimensions.width}px`,
              maxWidth: '100%',
              height: `${pageDimensions.height}px`,
              cursor: mode === 'add-text' ? 'crosshair' : mode === 'whiteout' ? 'cell' : 'default',
            }}
          >
            {/* Background PDF Page Image */}
            <img
              src={pageDataUrl}
              alt={`PDF Page ${currentPage}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Whiteout Eraser Boxes */}
            {currentPageEdits.whiteouts.map((w) => (
              <div
                key={w.id}
                className="absolute bg-white border border-dashed border-slate-300 group z-10"
                style={{
                  left: `${w.xPercent}%`,
                  top: `${w.yPercent}%`,
                  width: `${w.widthPercent}%`,
                  height: `${w.heightPercent}%`,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => removeWhiteout(w.id, e)}
                  title="Remove whiteout"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs text-xs cursor-pointer z-20"
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Detected In-Line Text Elements */}
            {currentTextItems.map((item) => {
              const editedValue = currentPageEdits.editedItems[item.id];
              const isEdited = editedValue !== undefined && editedValue !== item.originalText;
              const isEditing = activeItemId === item.id;
              const displayText = editedValue !== undefined ? editedValue : item.originalText;

              return (
                <div
                  key={item.id}
                  style={{
                    left: `${item.xPercent}%`,
                    top: `${item.yPercent}%`,
                    width: `${Math.max(item.widthPercent, 4)}%`,
                    height: `${item.heightPercent}%`,
                    fontFamily: item.fontFamily,
                    fontSize: `${item.fontSize}px`,
                    fontWeight: item.isBold ? 'bold' : 'normal',
                    fontStyle: item.isItalic ? 'italic' : 'normal',
                  }}
                  className={`absolute z-15 transition-all ${
                    isEditing
                      ? 'ring-2 ring-brand-500 bg-white shadow-md z-30'
                      : isEdited
                      ? 'bg-amber-100/90 text-slate-900 border border-amber-300'
                      : 'hover:bg-brand-500/15 hover:ring-1 hover:ring-brand-400 cursor-text'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === 'edit-text') {
                      setActiveItemId(item.id);
                    }
                  }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={displayText}
                      onChange={(e) => handleTextChange(item.id, e.target.value)}
                      onBlur={() => setActiveItemId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setActiveItemId(null);
                        }
                      }}
                      style={{
                        fontFamily: item.fontFamily,
                        fontSize: `${item.fontSize}px`,
                        fontWeight: item.isBold ? 'bold' : 'normal',
                        fontStyle: item.isItalic ? 'italic' : 'normal',
                      }}
                      className="w-full h-full bg-white text-black px-0.5 outline-none border-none leading-none"
                    />
                  ) : isEdited ? (
                    <span className="w-full h-full block bg-white text-black leading-none whitespace-nowrap overflow-hidden">
                      {displayText}
                    </span>
                  ) : null}
                </div>
              );
            })}

            {/* Custom Added Text Boxes */}
            {currentPageEdits.customBoxes.map((box) => (
              <div
                key={box.id}
                style={{
                  left: `${box.xPercent}%`,
                  top: `${box.yPercent}%`,
                  color: box.color,
                  fontFamily: box.fontFamily,
                  fontSize: `${box.fontSize}px`,
                  fontWeight: box.isBold ? 'bold' : 'normal',
                  fontStyle: box.isItalic ? 'italic' : 'normal',
                }}
                className="absolute z-20 group border border-dashed border-brand-400 bg-white/90 p-1 rounded min-w-[60px]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={box.text}
                  onChange={(e) => {
                    const newTxt = e.target.value;
                    setAllEdits((prev) => {
                      const pageEdit = prev[currentPage] || { editedItems: {}, customBoxes: [], whiteouts: [] };
                      return {
                        ...prev,
                        [currentPage]: {
                          ...pageEdit,
                          customBoxes: pageEdit.customBoxes.map((b) =>
                            b.id === box.id ? { ...b, text: newTxt } : b
                          ),
                        },
                      };
                    });
                  }}
                  style={{
                    color: box.color,
                    fontFamily: box.fontFamily,
                    fontSize: `${box.fontSize}px`,
                    fontWeight: box.isBold ? 'bold' : 'normal',
                    fontStyle: box.isItalic ? 'italic' : 'normal',
                  }}
                  className="bg-transparent outline-none border-none w-full"
                />
                <button
                  type="button"
                  onClick={(e) => removeCustomBox(box.id, e)}
                  title="Delete text"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
