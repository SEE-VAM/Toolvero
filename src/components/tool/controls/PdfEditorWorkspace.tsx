import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  Type,
  Eraser,
  Download,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Upload,
  FileText,
  Bold,
  Italic,
  HelpCircle,
  PenTool,
  Image as ImageIcon,
  Square,
  Circle as CircleIcon,
  Minus,
  Stamp as StampIcon,
  RotateCw,
  ShieldCheck,
  X,
  Move,
  FileDown
} from 'lucide-react';
import {
  loadPdfPageForEditing,
  exportEditedPdf,
  exportPageAsImage,
  DetectedTextItem,
  CustomTextBox,
  WhiteoutBox,
  PageEdits,
  PlacableImage,
  PlacableShape,
  PlacableStamp,
} from '../../../services/pdfProcessor';
import { ProcessResult } from '../../../types/tool';
import { formatBytes } from '../../../utils/fileHelpers';
import { ProgressBar } from '../ProgressBar';
import { ToastMessage } from '../../common/Toast';

interface PdfEditorWorkspaceProps {
  onShowToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

type CanvaTab = 'text' | 'sign' | 'image' | 'shapes' | 'stamps' | 'pages' | 'whiteout';
type EditorMode = 'edit-text' | 'add-text' | 'whiteout' | 'none';

interface DraggingState {
  type: 'customText' | 'whiteout' | 'image' | 'signature' | 'shape' | 'stamp';
  id: string;
  startXPercent: number;
  startYPercent: number;
  startMouseX: number;
  startMouseY: number;
}

interface ResizingState {
  type: 'image' | 'signature' | 'shape' | 'whiteout' | 'stamp';
  id: string;
  handle: 'se' | 'sw' | 'ne' | 'nw';
  startXPercent: number;
  startYPercent: number;
  startWidthPercent: number;
  startHeightPercent: number;
  startMouseX: number;
  startMouseY: number;
}

export const PdfEditorWorkspace: React.FC<PdfEditorWorkspaceProps> = ({ onShowToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  // Active Canva Category Tab & Interaction Mode
  const [activeTab, setActiveTab] = useState<CanvaTab>('text');
  const [mode, setMode] = useState<EditorMode>('edit-text');

  // Page background image and extracted text
  const [pageDataUrl, setPageDataUrl] = useState<string>('');
  const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1100 });

  // Stored items and edits per page
  const [pageItemsMap, setPageItemsMap] = useState<Record<number, DetectedTextItem[]>>({});
  const [allEdits, setAllEdits] = useState<Record<number, PageEdits>>({});
  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());

  // Active editing text item
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Text styling toolbar state
  const [selectedFont, setSelectedFont] = useState<'sans-serif' | 'serif' | 'monospace'>('sans-serif');
  const [selectedFontSize, setSelectedFontSize] = useState<number>(14);
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Dragging and Resizing state for placable elements
  const [draggingItem, setDraggingItem] = useState<DraggingState | null>(null);
  const [resizingItem, setResizingItem] = useState<ResizingState | null>(null);

  // Signature Modal state
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [sigMode, setSigMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSigName, setTypedSigName] = useState('John Doe');
  const [selectedSigFont, setSelectedSigFont] = useState<'Dancing Script' | 'Caveat' | 'cursive'>('Dancing Script');
  const [sigPenColor, setSigPenColor] = useState('#000000');
  const [sigPenWidth, setSigPenWidth] = useState(3);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  // Processing & Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const sigUploadRef = useRef<HTMLInputElement>(null);
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to get or initialize edits for current page
  const getCurrentPageEdits = (pageNum: number = currentPage): PageEdits => {
    return (
      allEdits[pageNum] || {
        editedItems: {},
        customBoxes: [],
        whiteouts: [],
        signatures: [],
        images: [],
        shapes: [],
        stamps: [],
        rotation: 0,
      }
    );
  };

  const currentPageEdits = getCurrentPageEdits(currentPage);
  const currentTextItems = pageItemsMap[currentPage] || [];
  const isCurrentPageDeleted = deletedPages.has(currentPage);
  const activeItem = currentTextItems.find((t) => t.id === activeItemId);

  const updateCurrentItemTypography = (updater: (item: DetectedTextItem) => DetectedTextItem) => {
    if (!activeItemId) return;
    setPageItemsMap((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).map((it) =>
        it.id === activeItemId ? updater(it) : it
      ),
    }));
  };

  // Load page data whenever currentPage, file, or page rotation changes
  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    setIsLoadingPage(true);

    const rot = currentPageEdits.rotation || 0;

    loadPdfPageForEditing(file, currentPage, 1.5, rot)
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
  }, [file, currentPage, currentPageEdits.rotation]);

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
    setDeletedPages(new Set());
    setResult(null);
    onShowToast({
      type: 'info',
      message: `Opened "${selectedFile.name}". Select any tool above to edit!`,
    });
  };

  // --- Element Updates ---
  const updatePageEdits = (updater: (prev: PageEdits) => PageEdits) => {
    setAllEdits((prev) => {
      const current = prev[currentPage] || {
        editedItems: {},
        customBoxes: [],
        whiteouts: [],
        signatures: [],
        images: [],
        shapes: [],
        stamps: [],
        rotation: 0,
      };
      return {
        ...prev,
        [currentPage]: updater(current),
      };
    });
  };

  // Text Replacement in Matching Font
  const handleTextChange = (itemId: string, newText: string) => {
    updatePageEdits((page) => ({
      ...page,
      editedItems: {
        ...page.editedItems,
        [itemId]: newText,
      },
    }));
  };


  // --- Dragging & Resizing Handlers ---
  const handleMouseDown = (
    e: React.MouseEvent,
    type: DraggingState['type'],
    id: string,
    currentX: number,
    currentY: number
  ) => {
    e.stopPropagation();
    setDraggingItem({
      type,
      id,
      startXPercent: currentX,
      startYPercent: currentY,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    });
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    type: ResizingState['type'],
    id: string,
    handle: 'se' | 'sw' | 'ne' | 'nw',
    currentX: number,
    currentY: number,
    currentW: number,
    currentH: number
  ) => {
    e.stopPropagation();
    setResizingItem({
      type,
      id,
      handle,
      startXPercent: currentX,
      startYPercent: currentY,
      startWidthPercent: currentW,
      startHeightPercent: currentH,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!documentContainerRef.current) return;
    const rect = documentContainerRef.current.getBoundingClientRect();

    // 1. Handle Resizing
    if (resizingItem) {
      const deltaXPercent = ((e.clientX - resizingItem.startMouseX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - resizingItem.startMouseY) / rect.height) * 100;

      let newW = resizingItem.startWidthPercent;
      let newH = resizingItem.startHeightPercent;
      let newX = resizingItem.startXPercent;
      let newY = resizingItem.startYPercent;

      if (resizingItem.type === 'stamp') {
        const aspect =
          resizingItem.startWidthPercent && resizingItem.startHeightPercent
            ? resizingItem.startWidthPercent / resizingItem.startHeightPercent
            : 24 / 6.5;

        if (resizingItem.handle === 'se') {
          newW = Math.max(12, Math.min(80, resizingItem.startWidthPercent + deltaXPercent));
          newH = newW / aspect;
        } else if (resizingItem.handle === 'sw') {
          const candidateW = resizingItem.startWidthPercent - deltaXPercent;
          if (candidateW >= 12 && resizingItem.startXPercent + deltaXPercent >= 0) {
            newX = resizingItem.startXPercent + deltaXPercent;
            newW = candidateW;
            newH = newW / aspect;
          }
        } else if (resizingItem.handle === 'ne') {
          newW = Math.max(12, Math.min(80, resizingItem.startWidthPercent + deltaXPercent));
          newH = newW / aspect;
          const candidateY = resizingItem.startYPercent + (resizingItem.startHeightPercent - newH);
          if (candidateY >= 0) {
            newY = candidateY;
          }
        } else if (resizingItem.handle === 'nw') {
          const candidateW = resizingItem.startWidthPercent - deltaXPercent;
          if (candidateW >= 12 && resizingItem.startXPercent + deltaXPercent >= 0) {
            newX = resizingItem.startXPercent + deltaXPercent;
            newW = candidateW;
            newH = newW / aspect;
            const candidateY = resizingItem.startYPercent + (resizingItem.startHeightPercent - newH);
            if (candidateY >= 0) {
              newY = candidateY;
            }
          }
        }
      } else if (resizingItem.handle === 'se') {
        newW = Math.max(3, Math.min(100 - resizingItem.startXPercent, resizingItem.startWidthPercent + deltaXPercent));
        newH = Math.max(2, Math.min(100 - resizingItem.startYPercent, resizingItem.startHeightPercent + deltaYPercent));
      } else if (resizingItem.handle === 'sw') {
        const candidateW = resizingItem.startWidthPercent - deltaXPercent;
        if (candidateW >= 3 && resizingItem.startXPercent + deltaXPercent >= 0) {
          newX = resizingItem.startXPercent + deltaXPercent;
          newW = candidateW;
        }
        newH = Math.max(2, Math.min(100 - resizingItem.startYPercent, resizingItem.startHeightPercent + deltaYPercent));
      } else if (resizingItem.handle === 'ne') {
        newW = Math.max(3, Math.min(100 - resizingItem.startXPercent, resizingItem.startWidthPercent + deltaXPercent));
        const candidateH = resizingItem.startHeightPercent - deltaYPercent;
        if (candidateH >= 2 && resizingItem.startYPercent + deltaYPercent >= 0) {
          newY = resizingItem.startYPercent + deltaYPercent;
          newH = candidateH;
        }
      } else if (resizingItem.handle === 'nw') {
        const candidateW = resizingItem.startWidthPercent - deltaXPercent;
        if (candidateW >= 3 && resizingItem.startXPercent + deltaXPercent >= 0) {
          newX = resizingItem.startXPercent + deltaXPercent;
          newW = candidateW;
        }
        const candidateH = resizingItem.startHeightPercent - deltaYPercent;
        if (candidateH >= 2 && resizingItem.startYPercent + deltaYPercent >= 0) {
          newY = resizingItem.startYPercent + deltaYPercent;
          newH = candidateH;
        }
      }

      updatePageEdits((page) => {
        if (resizingItem.type === 'image') {
          return {
            ...page,
            images: page.images.map((img) =>
              img.id === resizingItem.id
                ? { ...img, xPercent: newX, yPercent: newY, widthPercent: newW, heightPercent: newH }
                : img
            ),
          };
        }
        if (resizingItem.type === 'signature') {
          return {
            ...page,
            signatures: page.signatures.map((sig) =>
              sig.id === resizingItem.id
                ? { ...sig, xPercent: newX, yPercent: newY, widthPercent: newW, heightPercent: newH }
                : sig
            ),
          };
        }
        if (resizingItem.type === 'shape') {
          return {
            ...page,
            shapes: page.shapes.map((sh) =>
              sh.id === resizingItem.id
                ? { ...sh, xPercent: newX, yPercent: newY, widthPercent: newW, heightPercent: newH }
                : sh
            ),
          };
        }
        if (resizingItem.type === 'whiteout') {
          return {
            ...page,
            whiteouts: page.whiteouts.map((w) =>
              w.id === resizingItem.id
                ? { ...w, xPercent: newX, yPercent: newY, widthPercent: newW, heightPercent: newH }
                : w
            ),
          };
        }
        if (resizingItem.type === 'stamp') {
          return {
            ...page,
            stamps: page.stamps.map((st) =>
              st.id === resizingItem.id
                ? { ...st, xPercent: newX, yPercent: newY, widthPercent: newW, heightPercent: newH }
                : st
            ),
          };
        }
        return page;
      });
      return;
    }

    // 2. Handle Dragging Position
    if (draggingItem) {
      const deltaXPercent = ((e.clientX - draggingItem.startMouseX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - draggingItem.startMouseY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(96, draggingItem.startXPercent + deltaXPercent));
      const newY = Math.max(0, Math.min(96, draggingItem.startYPercent + deltaYPercent));

      updatePageEdits((page) => {
        if (draggingItem.type === 'customText') {
          return {
            ...page,
            customBoxes: page.customBoxes.map((b) =>
              b.id === draggingItem.id ? { ...b, xPercent: newX, yPercent: newY } : b
            ),
          };
        }
        if (draggingItem.type === 'whiteout') {
          return {
            ...page,
            whiteouts: page.whiteouts.map((w) =>
              w.id === draggingItem.id ? { ...w, xPercent: newX, yPercent: newY } : w
            ),
          };
        }
        if (draggingItem.type === 'image') {
          return {
            ...page,
            images: page.images.map((img) =>
              img.id === draggingItem.id ? { ...img, xPercent: newX, yPercent: newY } : img
            ),
          };
        }
        if (draggingItem.type === 'signature') {
          return {
            ...page,
            signatures: page.signatures.map((sig) =>
              sig.id === draggingItem.id ? { ...sig, xPercent: newX, yPercent: newY } : sig
            ),
          };
        }
        if (draggingItem.type === 'shape') {
          return {
            ...page,
            shapes: page.shapes.map((sh) =>
              sh.id === draggingItem.id ? { ...sh, xPercent: newX, yPercent: newY } : sh
            ),
          };
        }
        if (draggingItem.type === 'stamp') {
          return {
            ...page,
            stamps: page.stamps.map((st) =>
              st.id === draggingItem.id ? { ...st, xPercent: newX, yPercent: newY } : st
            ),
          };
        }
        return page;
      });
    }
  };

  const handleMouseUp = () => {
    if (resizingItem) {
      setResizingItem(null);
    }
    if (draggingItem) {
      setDraggingItem(null);
    }
  };

  // Canvas Click: Insert element based on active mode
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
        fontFamily:
          selectedFont === 'serif'
            ? "'Times New Roman', 'Times', serif"
            : selectedFont === 'monospace'
            ? "'Consolas', 'Courier New', monospace"
            : "'Calibri', 'Arial', sans-serif",
        color: selectedColor,
        isBold,
        isItalic,
      };

      updatePageEdits((page) => ({
        ...page,
        customBoxes: [...page.customBoxes, newBox],
      }));

      onShowToast({
        type: 'info',
        message: 'Text box added! Type your text and drag to reposition.',
      });
    } else if (mode === 'whiteout') {
      const newWhiteout: WhiteoutBox = {
        id: `whiteout_${Date.now()}`,
        xPercent: Math.max(0, xPercent - 5),
        yPercent: Math.max(0, yPercent - 2),
        widthPercent: 14,
        heightPercent: 4,
      };

      updatePageEdits((page) => ({
        ...page,
        whiteouts: [...page.whiteouts, newWhiteout],
      }));

      onShowToast({
        type: 'info',
        message: 'Whiteout eraser placed. Drag to cover any unneeded content.',
      });
    }
  };

  // --- Canva Feature Handlers ---

  // 1. Digital e-Signatures
  const handleAddSignature = (dataUrl: string) => {
    const newSig: PlacableImage = {
      id: `sig_${Date.now()}`,
      dataUrl,
      xPercent: 35,
      yPercent: 60,
      widthPercent: 26,
      heightPercent: 12,
    };

    updatePageEdits((page) => ({
      ...page,
      signatures: [...page.signatures, newSig],
    }));

    setIsSigModalOpen(false);
    onShowToast({
      type: 'success',
      message: 'Signature inserted! Drag to move it to the signature line.',
    });
  };

  const handleInitSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const clearSigCanvas = () => {
    handleInitSigCanvas();
  };

  const handleSaveDrawnSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    handleAddSignature(dataUrl);
  };

  const handleSaveTypedSignature = () => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 400;
    offCanvas.height = 140;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 400, 140);
    ctx.fillStyle = sigPenColor;
    ctx.font = `italic bold 52px "${selectedSigFont}", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedSigName || 'Signature', 200, 70);

    const dataUrl = offCanvas.toDataURL('image/png');
    handleAddSignature(dataUrl);
  };

  const handleSigImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFile = e.target.files?.[0];
    if (!uploadFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleAddSignature(dataUrl);
      }
    };
    reader.readAsDataURL(uploadFile);
    e.target.value = '';
  };

  // 2. Photo & Logo Insertion
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFile = e.target.files?.[0];
    if (!uploadFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const newImg: PlacableImage = {
          id: `img_${Date.now()}`,
          dataUrl,
          xPercent: 30,
          yPercent: 30,
          widthPercent: 24,
          heightPercent: 18,
        };

        updatePageEdits((page) => ({
          ...page,
          images: [...page.images, newImg],
        }));

        onShowToast({
          type: 'success',
          message: 'Image added! Drag to place or use corners to resize.',
        });
      }
    };
    reader.readAsDataURL(uploadFile);
    e.target.value = '';
  };

  // 3. Highlighters & Shapes
  const handleAddHighlighter = (color: string) => {
    const newShape: PlacableShape = {
      id: `shape_${Date.now()}`,
      type: 'highlight',
      color,
      opacity: 0.45,
      strokeWidth: 0,
      xPercent: 20,
      yPercent: 40,
      widthPercent: 35,
      heightPercent: 3,
    };

    updatePageEdits((page) => ({
      ...page,
      shapes: [...page.shapes, newShape],
    }));

    onShowToast({
      type: 'info',
      message: 'Highlighter placed. Drag over the text you wish to highlight.',
    });
  };

  const handleAddShape = (type: 'rectangle' | 'circle' | 'line', color: string = '#2563eb') => {
    const newShape: PlacableShape = {
      id: `shape_${Date.now()}`,
      type,
      color,
      opacity: 1.0,
      strokeWidth: 2.5,
      xPercent: 25,
      yPercent: 35,
      widthPercent: type === 'line' ? 30 : 20,
      heightPercent: type === 'line' ? 1 : 14,
    };

    updatePageEdits((page) => ({
      ...page,
      shapes: [...page.shapes, newShape],
    }));

    onShowToast({
      type: 'info',
      message: `Added ${type}. Drag to reposition anywhere on the page.`,
    });
  };

  // 4. One-Click Status Stamps
  const handleAddStamp = (text: string, color: string) => {
    const newStamp: PlacableStamp = {
      id: `stamp_${Date.now()}`,
      text,
      color,
      xPercent: 35,
      yPercent: 35,
      widthPercent: 24,
      heightPercent: 6.5,
    };

    updatePageEdits((page) => ({
      ...page,
      stamps: [...page.stamps, newStamp],
    }));

    onShowToast({
      type: 'success',
      message: `Stamp "${text}" placed! Drag to reposition.`,
    });
  };

  // 5. Page Tools (Rotate & Delete)
  const handleRotatePage = () => {
    const currentRot = currentPageEdits.rotation || 0;
    const nextRot = (currentRot + 90) % 360;

    updatePageEdits((page) => ({
      ...page,
      rotation: nextRot,
    }));

    onShowToast({
      type: 'info',
      message: `Page ${currentPage} rotated to ${nextRot}°.`,
    });
  };

  const handleToggleDeletePage = () => {
    setDeletedPages((prev) => {
      const updated = new Set(prev);
      if (updated.has(currentPage)) {
        updated.delete(currentPage);
        onShowToast({
          type: 'success',
          message: `Page ${currentPage} restored.`,
        });
      } else {
        updated.add(currentPage);
        onShowToast({
          type: 'info',
          message: `Page ${currentPage} marked as deleted. It will be excluded from the PDF.`,
        });
      }
      return updated;
    });
  };

  // 6. Multi-Format Single Page Exports
  const handleExportSinglePage = async (format: 'jpeg' | 'png') => {
    if (!file) return;
    setIsExportingImage(true);

    try {
      const { dataUrl, filename } = await exportPageAsImage(
        file,
        currentPage,
        currentPageEdits,
        currentTextItems,
        format
      );

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onShowToast({
        type: 'success',
        message: `Exported Page ${currentPage} as ${format.toUpperCase()}!`,
      });
    } catch (err: any) {
      console.error('Failed to export page as image:', err);
      onShowToast({
        type: 'error',
        message: 'Failed to export page as image.',
      });
    } finally {
      setIsExportingImage(false);
    }
  };

  // Reset current page edits
  const handleResetCurrentPage = () => {
    updatePageEdits(() => ({
      editedItems: {},
      customBoxes: [],
      whiteouts: [],
      signatures: [],
      images: [],
      shapes: [],
      stamps: [],
      rotation: 0,
    }));
    setActiveItemId(null);
    onShowToast({
      type: 'info',
      message: `Cleared all additions and edits on page ${currentPage}.`,
    });
  };

  // Full PDF Export
  const handleExport = async () => {
    if (!file) return;

    if (deletedPages.size >= numPages) {
      onShowToast({
        type: 'error',
        message: 'Cannot export: All pages in the PDF have been deleted.',
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(5);

    try {
      const res = await exportEditedPdf(
        file,
        allEdits,
        pageItemsMap,
        deletedPages,
        (p) => setExportProgress(p)
      );
      setResult(res);
      setIsExporting(false);
      onShowToast({
        type: 'success',
        message: 'Edited PDF compiled successfully!',
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

  const handleResetWorkspace = () => {
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    setFile(null);
    setResult(null);
    setCurrentPage(1);
    setAllEdits({});
    setPageItemsMap({});
    setDeletedPages(new Set());
  };

  // --- Success Result Screen ---
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
              All text changes, signatures, stamps, shapes, and images were compiled into your document.
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
                Size: {formatBytes(result.processedSize)} &bull; {result.metadata?.pages || numPages} Active Pages
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
            onClick={handleResetWorkspace}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Edit Another PDF Document</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Upload Screen ---
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
          Full Canva-style editing: Edit existing text in original matching font, draw signatures, insert logos, add status stamps, highlight text, and rotate/delete pages. 100% in-browser privacy.
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
      {/* Hidden file inputs for image & signature uploads */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={sigUploadRef}
        type="file"
        accept="image/*"
        onChange={handleSigImageUpload}
        className="hidden"
      />

      {/* Top Canva Tool Navigation Tabs */}
      <div className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Text Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setMode('edit-text');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text</span>
          </button>

          {/* Signature Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('sign');
              setMode('none');
              setIsSigModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sign'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Signature</span>
          </button>

          {/* Image Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              setMode('none');
              imageUploadRef.current?.click();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'image'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Add Image / Logo</span>
          </button>

          {/* Shapes & Highlighters Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('shapes');
              setMode('none');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'shapes'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Square className="w-4 h-4" />
            <span>Shapes & Highlight</span>
          </button>

          {/* Status Stamps Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('stamps');
              setMode('none');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'stamps'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <StampIcon className="w-4 h-4" />
            <span>Stamps</span>
          </button>

          {/* Whiteout Eraser Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('whiteout');
              setMode('whiteout');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'whiteout'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
          </button>

          {/* Page Tools Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pages');
              setMode('none');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span>Page Tools</span>
          </button>
        </div>

        {/* Global Export & Reset Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Contextual Sub-Toolbar based on Active Canva Tab */}
      <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* TEXT CONTROLS */}
        {activeTab === 'text' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode('edit-text')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  mode === 'edit-text'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Click & Replace (In Font)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('add-text')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  mode === 'add-text'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Insert New Text Box</span>
              </button>
            </div>

            {(mode === 'add-text' || activeItemId !== null) && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center gap-2 flex-wrap"
              >
                <select
                  value={
                    activeItem
                      ? activeItem.fontFamily.includes('Times') ||
                        (activeItem.fontFamily.includes('serif') && !activeItem.fontFamily.includes('sans'))
                        ? 'serif'
                        : activeItem.fontFamily.includes('mono')
                        ? 'monospace'
                        : 'sans-serif'
                      : selectedFont
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedFont(val as any);
                    if (activeItemId) {
                      updateCurrentItemTypography((it) => ({
                        ...it,
                        fontFamily:
                          val === 'serif'
                            ? "'Times New Roman', 'Times', serif"
                            : val === 'monospace'
                            ? "'Consolas', 'Courier New', monospace"
                            : "'Calibri', 'Arial', sans-serif",
                      }));
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="sans-serif">Sans-Serif (Arial / Calibri)</option>
                  <option value="serif">Serif (Times New Roman)</option>
                  <option value="monospace">Monospace (Courier)</option>
                </select>

                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeItemId) {
                        updateCurrentItemTypography((it) => ({ ...it, fontSize: Math.max(8, it.fontSize - 1) }));
                      } else {
                        setSelectedFontSize((s) => Math.max(8, s - 1));
                      }
                    }}
                    className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {activeItem ? activeItem.fontSize : selectedFontSize}px
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeItemId) {
                        updateCurrentItemTypography((it) => ({ ...it, fontSize: Math.min(48, it.fontSize + 1) }));
                      } else {
                        setSelectedFontSize((s) => Math.min(48, s + 1));
                      }
                    }}
                    className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <input
                  type="color"
                  value={activeItem?.textColor || selectedColor}
                  onChange={(e) => {
                    setSelectedColor(e.target.value);
                    if (activeItemId) {
                      updateCurrentItemTypography((it) => ({ ...it, textColor: e.target.value }));
                    }
                  }}
                  title="Text Color"
                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-white"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (activeItemId) {
                      updateCurrentItemTypography((it) => ({ ...it, isBold: !it.isBold }));
                    } else {
                      setIsBold(!isBold);
                    }
                  }}
                  className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                    (activeItem ? activeItem.isBold : isBold)
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                  title="Toggle Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeItemId) {
                      updateCurrentItemTypography((it) => ({ ...it, isItalic: !it.isItalic }));
                    } else {
                      setIsItalic(!isItalic);
                    }
                  }}
                  className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                    (activeItem ? activeItem.isItalic : isItalic)
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/60 text-brand-700'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                  title="Toggle Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* SHAPES & HIGHLIGHT CONTROLS */}
        {activeTab === 'shapes' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Highlighter:</span>
              <button
                type="button"
                onClick={() => handleAddHighlighter('#fef08a')}
                title="Yellow Highlighter"
                className="w-6 h-6 rounded-full bg-yellow-300 border border-yellow-400 hover:scale-110 transition-transform cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleAddHighlighter('#bbf7d0')}
                title="Green Highlighter"
                className="w-6 h-6 rounded-full bg-emerald-300 border border-emerald-400 hover:scale-110 transition-transform cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleAddHighlighter('#bae6fd')}
                title="Blue Highlighter"
                className="w-6 h-6 rounded-full bg-sky-300 border border-sky-400 hover:scale-110 transition-transform cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleAddHighlighter('#fbcfe8')}
                title="Pink Highlighter"
                className="w-6 h-6 rounded-full bg-pink-300 border border-pink-400 hover:scale-110 transition-transform cursor-pointer"
              />
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Shapes:</span>
              <button
                type="button"
                onClick={() => handleAddShape('rectangle')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 text-blue-600" />
                <span>Rectangle</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddShape('circle')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <CircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Circle</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddShape('line')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 text-slate-700" />
                <span>Divider Line</span>
              </button>
            </div>
          </div>
        )}

        {/* STAMPS CONTROLS */}
        {activeTab === 'stamps' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">1-Click Status Stamp:</span>
            <button
              type="button"
              onClick={() => handleAddStamp('APPROVED', '#059669')}
              className="px-3 py-1 rounded-lg border-2 border-emerald-600 text-emerald-700 font-extrabold text-xs tracking-wider hover:bg-emerald-50 cursor-pointer shadow-xs"
            >
              APPROVED
            </button>
            <button
              type="button"
              onClick={() => handleAddStamp('PAID', '#2563eb')}
              className="px-3 py-1 rounded-lg border-2 border-blue-600 text-blue-700 font-extrabold text-xs tracking-wider hover:bg-blue-50 cursor-pointer shadow-xs"
            >
              PAID
            </button>
            <button
              type="button"
              onClick={() => handleAddStamp('CONFIDENTIAL', '#dc2626')}
              className="px-3 py-1 rounded-lg border-2 border-red-600 text-red-700 font-extrabold text-xs tracking-wider hover:bg-red-50 cursor-pointer shadow-xs"
            >
              CONFIDENTIAL
            </button>
            <button
              type="button"
              onClick={() => handleAddStamp('VERIFIED', '#7c3aed')}
              className="px-3 py-1 rounded-lg border-2 border-purple-600 text-purple-700 font-extrabold text-xs tracking-wider hover:bg-purple-50 cursor-pointer shadow-xs"
            >
              VERIFIED
            </button>
            <button
              type="button"
              onClick={() => handleAddStamp('DRAFT', '#d97706')}
              className="px-3 py-1 rounded-lg border-2 border-amber-600 text-amber-700 font-extrabold text-xs tracking-wider hover:bg-amber-50 cursor-pointer shadow-xs"
            >
              DRAFT
            </button>
          </div>
        )}

        {/* WHITEOUT CONTROLS */}
        {activeTab === 'whiteout' && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Eraser className="w-4 h-4 text-brand-600" />
            <span>Click anywhere on the page to place a whiteout box. Drag and resize over unwanted text or logos.</span>
          </div>
        )}

        {/* PAGE TOOLS CONTROLS */}
        {activeTab === 'pages' && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleRotatePage}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-brand-600" />
              <span>Rotate Page 90°</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDeletePage}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                isCurrentPageDeleted
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isCurrentPageDeleted ? 'Restore Page' : 'Delete Page From PDF'}</span>
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Export Page As:</span>
              <button
                type="button"
                disabled={isExportingImage}
                onClick={() => handleExportSinglePage('jpeg')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                JPG
              </button>
              <button
                type="button"
                disabled={isExportingImage}
                onClick={() => handleExportSinglePage('png')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                PNG
              </button>
            </div>
          </div>
        )}

        {/* SIGNATURE / IMAGE PROMPTS */}
        {activeTab === 'sign' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSigModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Open Signature Pad</span>
            </button>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imageUploadRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Photo or Logo</span>
            </button>
          </div>
        )}

        {/* Right Pagination & Reset Toolbar */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Page Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoadingPage}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`px-2 ${isCurrentPageDeleted ? 'line-through text-rose-500 font-bold' : ''}`}>
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
            title="Clear all edits on current page"
            className="p-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Helpful hint banner */}
      <div className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 shrink-0 text-blue-500" />
          <span>
            {activeTab === 'text' && mode === 'edit-text' && 'Click directly on any line or word below to edit its text in the original matching font.'}
            {activeTab === 'text' && mode === 'add-text' && 'Click anywhere on the document to insert a new text box.'}
            {activeTab === 'whiteout' && 'Click on the page to place a whiteout box (eraser). Drag over content you want to hide.'}
            {activeTab === 'sign' && 'Signatures placed on page can be dragged and repositioned freely.'}
            {activeTab === 'image' && 'Images and logos can be dragged and positioned anywhere.'}
            {activeTab === 'shapes' && 'Shapes & highlighters can be dragged to annotate the document.'}
            {activeTab === 'stamps' && 'Click a stamp button above to place it, then drag to desired spot.'}
            {activeTab === 'pages' && 'Use page tools to rotate or delete unwanted pages before exporting.'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
          File: {file.name}
        </span>
      </div>

      {/* Export progress bar */}
      {isExporting && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <ProgressBar progress={exportProgress} label="Compiling all edited pages with matching typography and Canva elements..." />
        </div>
      )}

      {/* Document Viewport */}
      <div
        className="p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-x-auto flex justify-center min-h-[600px] relative select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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
            {/* Deleted Page Warning Overlay */}
            {isCurrentPageDeleted && (
              <div className="absolute inset-0 bg-rose-900/40 backdrop-blur-[2px] z-40 flex flex-col items-center justify-center text-white p-6 text-center">
                <Trash2 className="w-12 h-12 text-rose-300 mb-2" />
                <h4 className="text-xl font-bold">This page is marked as Deleted</h4>
                <p className="text-sm text-rose-100 mt-1 max-w-sm">
                  It will be excluded from the final exported PDF.
                </p>
                <button
                  type="button"
                  onClick={handleToggleDeletePage}
                  className="mt-4 px-4 py-2 rounded-xl bg-white text-rose-700 font-bold text-xs shadow-md hover:bg-rose-50 cursor-pointer"
                >
                  Restore Page
                </button>
              </div>
            )}

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
                onMouseDown={(e) => handleMouseDown(e, 'whiteout', w.id, w.xPercent, w.yPercent)}
                className="absolute bg-white border border-dashed border-slate-300 group z-10 cursor-move"
                style={{
                  left: `${w.xPercent}%`,
                  top: `${w.yPercent}%`,
                  width: `${w.widthPercent}%`,
                  height: `${w.heightPercent}%`,
                }}
              >
                <div className="absolute top-0 left-0 p-0.5 opacity-0 group-hover:opacity-100 bg-slate-200 text-slate-700 rounded text-[9px] pointer-events-none">
                  <Move className="w-2.5 h-2.5" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePageEdits((page) => ({
                      ...page,
                      whiteouts: page.whiteouts.filter((item) => item.id !== w.id),
                    }));
                  }}
                  title="Remove whiteout"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs text-xs cursor-pointer z-20"
                >
                  &times;
                </button>

                {/* 4 Corner Resize Handles */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'whiteout', w.id, 'se', w.xPercent, w.yPercent, w.widthPercent, w.heightPercent)
                  }
                  title="Drag to resize whiteout"
                  className="opacity-90 group-hover:opacity-100 absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-se-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'whiteout', w.id, 'sw', w.xPercent, w.yPercent, w.widthPercent, w.heightPercent)
                  }
                  title="Drag to resize whiteout"
                  className="opacity-90 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-sw-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'whiteout', w.id, 'ne', w.xPercent, w.yPercent, w.widthPercent, w.heightPercent)
                  }
                  title="Drag to resize whiteout"
                  className="opacity-90 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-ne-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'whiteout', w.id, 'nw', w.xPercent, w.yPercent, w.widthPercent, w.heightPercent)
                  }
                  title="Drag to resize whiteout"
                  className="opacity-90 group-hover:opacity-100 absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-nw-resize z-30 hover:scale-125 transition-transform"
                />
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
                    minWidth: `${Math.max(item.widthPercent, 3)}%`,
                    width: isEditing || isEdited ? 'max-content' : `${Math.max(item.widthPercent, 3)}%`,
                    maxWidth: '96%',
                    height: `${item.heightPercent}%`,
                    fontFamily: item.fontFamily,
                    fontSize: `${item.fontSize}px`,
                    lineHeight: 1,
                    fontWeight: item.isBold ? 'bold' : 'normal',
                    fontStyle: item.isItalic ? 'italic' : 'normal',
                  }}
                  className={`absolute z-15 transition-all flex items-center ${
                    isEditing
                      ? 'ring-2 ring-brand-500 bg-white shadow-lg z-30 rounded-xs'
                      : isEdited
                      ? 'bg-white text-slate-900 z-15 hover:outline hover:outline-1 hover:outline-brand-400 cursor-text'
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
                      size={Math.max(displayText.length + 1, 6)}
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
                        color: item.textColor || '#111827',
                        minWidth: '100%',
                        width: `${Math.max(displayText.length + 1, 6)}ch`,
                        lineHeight: 1,
                      }}
                      className="bg-white px-0.5 py-0 outline-none border-none leading-none block h-full"
                    />
                  ) : isEdited ? (
                    <span
                      style={{
                        lineHeight: 1,
                        color: item.textColor || '#111827',
                        fontFamily: item.fontFamily,
                        fontSize: `${item.fontSize}px`,
                        fontWeight: item.isBold ? 'bold' : 'normal',
                        fontStyle: item.isItalic ? 'italic' : 'normal',
                      }}
                      className="block px-0.5 py-0 leading-none whitespace-nowrap overflow-visible select-none"
                    >
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
                onMouseDown={(e) => handleMouseDown(e, 'customText', box.id, box.xPercent, box.yPercent)}
                style={{
                  left: `${box.xPercent}%`,
                  top: `${box.yPercent}%`,
                  color: box.color,
                  fontFamily: box.fontFamily,
                  fontSize: `${box.fontSize}px`,
                  fontWeight: box.isBold ? 'bold' : 'normal',
                  fontStyle: box.isItalic ? 'italic' : 'normal',
                  width: 'max-content',
                  maxWidth: '92%',
                }}
                className="absolute z-20 group border border-dashed border-transparent hover:border-brand-400 focus-within:border-brand-400 bg-white/95 px-1.5 py-0.5 rounded min-w-[60px] cursor-move shadow-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={box.text}
                  size={Math.max(box.text.length + 1, 6)}
                  onChange={(e) => {
                    const newTxt = e.target.value;
                    updatePageEdits((page) => ({
                      ...page,
                      customBoxes: page.customBoxes.map((b) =>
                        b.id === box.id ? { ...b, text: newTxt } : b
                      ),
                    }));
                  }}
                  style={{
                    color: box.color,
                    fontFamily: box.fontFamily,
                    fontSize: `${box.fontSize}px`,
                    fontWeight: box.isBold ? 'bold' : 'normal',
                    fontStyle: box.isItalic ? 'italic' : 'normal',
                    width: `${Math.max(box.text.length + 1, 6)}ch`,
                    minWidth: '60px',
                  }}
                  className="bg-transparent outline-none border-none leading-normal block"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePageEdits((page) => ({
                      ...page,
                      customBoxes: page.customBoxes.filter((b) => b.id !== box.id),
                    }));
                  }}
                  title="Delete text"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer"
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Highlighters & Shapes */}
            {currentPageEdits.shapes.map((sh) => (
              <div
                key={sh.id}
                onMouseDown={(e) => handleMouseDown(e, 'shape', sh.id, sh.xPercent, sh.yPercent)}
                style={{
                  left: `${sh.xPercent}%`,
                  top: `${sh.yPercent}%`,
                  width: `${sh.widthPercent}%`,
                  height: `${sh.heightPercent}%`,
                }}
                className="absolute z-18 group cursor-move select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {sh.type === 'highlight' && (
                  <div
                    style={{ backgroundColor: sh.color }}
                    className="w-full h-full opacity-45 rounded-xs"
                  />
                )}
                {sh.type === 'rectangle' && (
                  <div
                    style={{ borderColor: sh.color, borderWidth: `${sh.strokeWidth}px` }}
                    className="w-full h-full border-solid rounded-xs"
                  />
                )}
                {sh.type === 'circle' && (
                  <div
                    style={{ borderColor: sh.color, borderWidth: `${sh.strokeWidth}px` }}
                    className="w-full h-full border-solid rounded-full"
                  />
                )}
                {sh.type === 'line' && (
                  <div
                    style={{ backgroundColor: sh.color, height: `${sh.strokeWidth}px` }}
                    className="w-full"
                  />
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePageEdits((page) => ({
                      ...page,
                      shapes: page.shapes.filter((item) => item.id !== sh.id),
                    }));
                  }}
                  title="Delete element"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer z-30"
                >
                  &times;
                </button>

                {/* 4 Corner Resize Handles */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'shape', sh.id, 'se', sh.xPercent, sh.yPercent, sh.widthPercent, sh.heightPercent)
                  }
                  title="Drag to resize shape"
                  className="opacity-90 group-hover:opacity-100 absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full shadow-md cursor-se-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'shape', sh.id, 'sw', sh.xPercent, sh.yPercent, sh.widthPercent, sh.heightPercent)
                  }
                  title="Drag to resize shape"
                  className="opacity-90 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full shadow-md cursor-sw-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'shape', sh.id, 'ne', sh.xPercent, sh.yPercent, sh.widthPercent, sh.heightPercent)
                  }
                  title="Drag to resize shape"
                  className="opacity-90 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full shadow-md cursor-ne-resize z-30 hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'shape', sh.id, 'nw', sh.xPercent, sh.yPercent, sh.widthPercent, sh.heightPercent)
                  }
                  title="Drag to resize shape"
                  className="opacity-90 group-hover:opacity-100 absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full shadow-md cursor-nw-resize z-30 hover:scale-125 transition-transform"
                />
              </div>
            ))}

            {/* Inserted Images & Logos */}
            {currentPageEdits.images.map((img) => (
              <div
                key={img.id}
                onMouseDown={(e) => handleMouseDown(e, 'image', img.id, img.xPercent, img.yPercent)}
                style={{
                  left: `${img.xPercent}%`,
                  top: `${img.yPercent}%`,
                  width: `${img.widthPercent}%`,
                  height: `${img.heightPercent}%`,
                }}
                className="absolute z-20 group border-2 border-dashed border-blue-500 hover:border-blue-600 bg-transparent cursor-move select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={img.dataUrl}
                  alt="Inserted"
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePageEdits((page) => ({
                      ...page,
                      images: page.images.filter((item) => item.id !== img.id),
                    }));
                  }}
                  title="Delete image"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md cursor-pointer z-30 transition-opacity"
                >
                  &times;
                </button>

                {/* 4 Corner Resize Handles */}
                {/* Bottom-Right (SE) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'image', img.id, 'se', img.xPercent, img.yPercent, img.widthPercent, img.heightPercent)
                  }
                  title="Drag to resize image"
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-se-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Bottom-Left (SW) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'image', img.id, 'sw', img.xPercent, img.yPercent, img.widthPercent, img.heightPercent)
                  }
                  title="Drag to resize image"
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-sw-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Top-Right (NE) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'image', img.id, 'ne', img.xPercent, img.yPercent, img.widthPercent, img.heightPercent)
                  }
                  title="Drag to resize image"
                  className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-ne-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Top-Left (NW) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'image', img.id, 'nw', img.xPercent, img.yPercent, img.widthPercent, img.heightPercent)
                  }
                  title="Drag to resize image"
                  className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nw-resize z-30 hover:scale-125 transition-transform"
                />
              </div>
            ))}

            {/* Placed Signatures */}
            {currentPageEdits.signatures.map((sig) => (
              <div
                key={sig.id}
                onMouseDown={(e) => handleMouseDown(e, 'signature', sig.id, sig.xPercent, sig.yPercent)}
                style={{
                  left: `${sig.xPercent}%`,
                  top: `${sig.yPercent}%`,
                  width: `${sig.widthPercent}%`,
                  height: `${sig.heightPercent}%`,
                }}
                className="absolute z-22 group border-2 border-dashed border-emerald-500 hover:border-emerald-600 bg-transparent cursor-move select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={sig.dataUrl}
                  alt="Signature"
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePageEdits((page) => ({
                      ...page,
                      signatures: page.signatures.filter((item) => item.id !== sig.id),
                    }));
                  }}
                  title="Delete signature"
                  className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md cursor-pointer z-30 transition-opacity"
                >
                  &times;
                </button>

                {/* 4 Corner Resize Handles */}
                {/* Bottom-Right (SE) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'signature', sig.id, 'se', sig.xPercent, sig.yPercent, sig.widthPercent, sig.heightPercent)
                  }
                  title="Drag to resize signature"
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-md cursor-se-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Bottom-Left (SW) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'signature', sig.id, 'sw', sig.xPercent, sig.yPercent, sig.widthPercent, sig.heightPercent)
                  }
                  title="Drag to resize signature"
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-md cursor-sw-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Top-Right (NE) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'signature', sig.id, 'ne', sig.xPercent, sig.yPercent, sig.widthPercent, sig.heightPercent)
                  }
                  title="Drag to resize signature"
                  className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-md cursor-ne-resize z-30 hover:scale-125 transition-transform"
                />
                {/* Top-Left (NW) */}
                <div
                  onMouseDown={(e) =>
                    handleResizeMouseDown(e, 'signature', sig.id, 'nw', sig.xPercent, sig.yPercent, sig.widthPercent, sig.heightPercent)
                  }
                  title="Drag to resize signature"
                  className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-md cursor-nw-resize z-30 hover:scale-125 transition-transform"
                />
              </div>
            ))}

            {/* Placed Status Stamps */}
            {currentPageEdits.stamps.map((stamp) => {
              const stampW = stamp.widthPercent || 24;
              const stampH = stamp.heightPercent || 6.5;
              const pageH = pageDimensions.height || 1000;
              const pageW = pageDimensions.width || 750;
              const stampPixelHeight = (stampH / 100) * pageH;
              const stampPixelWidth = (stampW / 100) * pageW;
              const charCount = Math.max(stamp.text.length, 6);
              const maxFontFromWidth = Math.floor((stampPixelWidth - 14) / (charCount * 0.72));
              const fontSize = Math.max(
                10,
                Math.min(
                  Math.round(stampPixelHeight * 0.52),
                  maxFontFromWidth
                )
              );
              const borderWidth = Math.max(2, Math.round(stampPixelHeight * 0.075));

              return (
                <div
                  key={stamp.id}
                  onMouseDown={(e) => handleMouseDown(e, 'stamp', stamp.id, stamp.xPercent, stamp.yPercent)}
                  style={{
                    left: `${stamp.xPercent}%`,
                    top: `${stamp.yPercent}%`,
                    width: `${stampW}%`,
                    height: `${stampH}%`,
                    borderColor: stamp.color,
                    borderWidth: `${borderWidth}px`,
                    color: stamp.color,
                  }}
                  className="absolute z-25 group border-solid rounded-md font-black tracking-wider select-none transform -rotate-6 cursor-move bg-transparent hover:bg-black/5 flex items-center justify-center p-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className="text-center font-black select-none pointer-events-none whitespace-nowrap overflow-visible"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: 1,
                    }}
                  >
                    {stamp.text}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePageEdits((page) => ({
                        ...page,
                        stamps: page.stamps.filter((item) => item.id !== stamp.id),
                      }));
                    }}
                    title="Delete stamp"
                    className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer z-30"
                  >
                    &times;
                  </button>

                  {/* 4 Corner Resize Handles */}
                  <div
                    onMouseDown={(e) =>
                      handleResizeMouseDown(e, 'stamp', stamp.id, 'se', stamp.xPercent, stamp.yPercent, stampW, stampH)
                    }
                    title="Drag to resize stamp"
                    className="opacity-90 group-hover:opacity-100 absolute -bottom-2 -right-2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-se-resize z-30 hover:scale-125 transition-transform"
                  />
                  <div
                    onMouseDown={(e) =>
                      handleResizeMouseDown(e, 'stamp', stamp.id, 'sw', stamp.xPercent, stamp.yPercent, stampW, stampH)
                    }
                    title="Drag to resize stamp"
                    className="opacity-90 group-hover:opacity-100 absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-sw-resize z-30 hover:scale-125 transition-transform"
                  />
                  <div
                    onMouseDown={(e) =>
                      handleResizeMouseDown(e, 'stamp', stamp.id, 'ne', stamp.xPercent, stamp.yPercent, stampW, stampH)
                    }
                    title="Drag to resize stamp"
                    className="opacity-90 group-hover:opacity-100 absolute -top-2 -right-2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-ne-resize z-30 hover:scale-125 transition-transform"
                  />
                  <div
                    onMouseDown={(e) =>
                      handleResizeMouseDown(e, 'stamp', stamp.id, 'nw', stamp.xPercent, stamp.yPercent, stampW, stampH)
                    }
                    title="Drag to resize stamp"
                    className="opacity-90 group-hover:opacity-100 absolute -top-2 -left-2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow-md cursor-nw-resize z-30 hover:scale-125 transition-transform"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DIGITAL SIGNATURE MODAL */}
      {isSigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Create Digital Signature
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signature Tabs (Draw / Type / Upload) */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setSigMode('draw')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  sigMode === 'draw'
                    ? 'border-brand-600 text-brand-600 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setSigMode('type')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  sigMode === 'type'
                    ? 'border-brand-600 text-brand-600 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Type Cursive
              </button>
              <button
                type="button"
                onClick={() => setSigMode('upload')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  sigMode === 'upload'
                    ? 'border-brand-600 text-brand-600 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Upload File
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* TAB 1: DRAW SIGNATURE */}
              {sigMode === 'draw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Draw with your mouse, finger, or stylus:
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Color buttons */}
                      <button
                        type="button"
                        onClick={() => setSigPenColor('#000000')}
                        className={`w-5 h-5 rounded-full bg-black ${
                          sigPenColor === '#000000' ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setSigPenColor('#1d4ed8')}
                        className={`w-5 h-5 rounded-full bg-blue-700 ${
                          sigPenColor === '#1d4ed8' ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setSigPenColor('#dc2626')}
                        className={`w-5 h-5 rounded-full bg-red-600 ${
                          sigPenColor === '#dc2626' ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={clearSigCanvas}
                        className="ml-2 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
                    <canvas
                      ref={sigCanvasRef}
                      width={440}
                      height={180}
                      onMouseDown={(e) => {
                        const canvas = sigCanvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        setIsDrawingSig(true);
                        ctx.beginPath();
                        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                        ctx.strokeStyle = sigPenColor;
                        ctx.lineWidth = sigPenWidth;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawingSig) return;
                        const canvas = sigCanvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                        ctx.stroke();
                      }}
                      onMouseUp={() => setIsDrawingSig(false)}
                      onMouseLeave={() => setIsDrawingSig(false)}
                      className="cursor-crosshair w-full h-[180px]"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: TYPE SIGNATURE */}
              {sigMode === 'type' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Enter Your Full Name:
                    </label>
                    <input
                      type="text"
                      value={typedSigName}
                      onChange={(e) => setTypedSigName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Choose Signature Style:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        onClick={() => setSelectedSigFont('Dancing Script')}
                        className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                          selectedSigFont === 'Dancing Script'
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span style={{ fontFamily: 'Dancing Script, cursive', fontSize: '24px' }}>
                          {typedSigName || 'Signature'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">Dancing Script</p>
                      </div>

                      <div
                        onClick={() => setSelectedSigFont('Caveat')}
                        className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                          selectedSigFont === 'Caveat'
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span style={{ fontFamily: 'Caveat, cursive', fontSize: '26px' }}>
                          {typedSigName || 'Signature'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">Caveat</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: UPLOAD SIGNATURE */}
              {sigMode === 'upload' && (
                <div
                  onClick={() => sigUploadRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-900/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Upload Transparent Signature Image
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, or WebP</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              {sigMode === 'draw' && (
                <button
                  type="button"
                  onClick={handleSaveDrawnSignature}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  Add Signature to Document
                </button>
              )}
              {sigMode === 'type' && (
                <button
                  type="button"
                  onClick={handleSaveTypedSignature}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  Add Signature to Document
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
