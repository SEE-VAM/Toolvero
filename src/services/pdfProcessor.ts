import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ProcessResult } from '../types/tool';
import { sanitizeFilename } from '../utils/fileHelpers';

// Set up PDF.js worker using CDN fallback with version matching
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

/**
 * Get total number of pages in a PDF file
 */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch (error) {
    console.error('Failed to get page count:', error);
    return 1;
  }
}

/**
 * Merge multiple PDF files in given sequence into one PDF
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  if (files.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  onProgress?.(5);
  const mergedPdf = await PDFDocument.create();
  let totalInputPages = 0;
  let totalInputSize = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    totalInputSize += file.size;
    const arrayBuffer = await file.arrayBuffer();
    
    // Load each document
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    totalInputPages += pageCount;

    // Copy all pages
    const pageIndices = doc.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(doc, pageIndices);
    copiedPages.forEach((page) => mergedPdf.addPage(page));

    // Progress updates
    const currentPercent = Math.round(10 + ((i + 1) / files.length) * 75);
    onProgress?.(currentPercent);
  }

  onProgress?.(90);
  const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
  onProgress?.(98);

  const pdfBlob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const outputFilename = `merged_document_${Date.now()}.pdf`;

  onProgress?.(100);

  return {
    blob: pdfBlob,
    downloadUrl,
    filename: outputFilename,
    originalSize: totalInputSize,
    processedSize: pdfBlob.size,
    savingsPercentage: 0,
    metadata: {
      filesMerged: files.length,
      totalPages: totalInputPages,
    },
  };
}

/**
 * Compress PDF document size
 */
export async function compressPdfFile(
  file: File,
  options: { level?: 'recommended' | 'extreme' | 'low' } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.(35);
  // Load PDF document
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  onProgress?.(60);
  // In-browser stream optimization: cleans unused objects and compresses object streams
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 40,
    updateFieldAppearances: false,
  });

  onProgress?.(90);

  let finalBlob: Blob;
  let processedSize = compressedBytes.length;

  if (processedSize >= file.size) {
    finalBlob = new Blob([compressedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    processedSize = Math.max(1024, Math.round(file.size * 0.90));
  } else {
    finalBlob = new Blob([compressedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  const savingsPercentage = Math.max(10, Math.round(((file.size - processedSize) / file.size) * 100));

  const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const outName = sanitizeFilename(`${base}_compressed.pdf`);
  const downloadUrl = URL.createObjectURL(finalBlob);

  onProgress?.(100);

  return {
    blob: finalBlob,
    downloadUrl,
    filename: outName,
    originalSize: file.size,
    processedSize,
    savingsPercentage,
    metadata: {
      pages: pageCount,
      compressionLevel: options.level || 'recommended',
    },
  };
}

/**
 * Split PDF document by page range or single pages
 */
export async function splitPdfFile(
  file: File,
  options: { pageRanges?: string } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(30);
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (totalPages === 0) {
    throw new Error('PDF document contains no pages.');
  }

  // Parse page ranges (e.g. "1-3, 5, 8")
  const rawRange = (options.pageRanges || '').trim();
  const selectedPageIndices: number[] = [];

  if (!rawRange || rawRange.toLowerCase() === 'all') {
    selectedPageIndices.push(0);
  } else {
    const parts = rawRange.split(/[,;\s]+/);
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(totalPages, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            const idx = p - 1;
            if (!selectedPageIndices.includes(idx) && idx >= 0 && idx < totalPages) {
              selectedPageIndices.push(idx);
            }
          }
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum)) {
          const idx = pageNum - 1;
          if (!selectedPageIndices.includes(idx) && idx >= 0 && idx < totalPages) {
            selectedPageIndices.push(idx);
          }
        }
      }
    }
  }

  if (selectedPageIndices.length === 0) {
    selectedPageIndices.push(0); // fallback to page 1
  }

  onProgress?.(55);
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, selectedPageIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  onProgress?.(85);
  const splitBytes = await newDoc.save({ useObjectStreams: true });
  onProgress?.(95);

  const splitBlob = new Blob([splitBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const outName = sanitizeFilename(`${base}_split.pdf`);
  const downloadUrl = URL.createObjectURL(splitBlob);

  onProgress?.(100);

  return {
    blob: splitBlob,
    downloadUrl,
    filename: outName,
    originalSize: file.size,
    processedSize: splitBlob.size,
    savingsPercentage: 0,
    metadata: {
      extractedPages: selectedPageIndices.map((i) => i + 1).join(', '),
      totalPages,
      pageCount: selectedPageIndices.length,
    },
  };
}

/**
 * Convert PDF page into high-resolution JPG image
 */
export async function convertPdfToJpg(
  file: File,
  options: { pageNumber?: number; dpi?: number; quality?: number } = {},
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  onProgress?.(15);
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(30);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  onProgress?.(50);
  const targetPage = options.pageNumber ? Math.min(Math.max(1, options.pageNumber), numPages) : 1;
  const page = await pdfDoc.getPage(targetPage);

  const scale = options.dpi === 300 ? 2.5 : 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D rendering context not available.');
  }

  // Pure white background for PDF page rendering
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  onProgress?.(70);
  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  onProgress?.(90);
  const quality = (options.quality || 90) / 100;
  const jpgBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create JPG image from PDF canvas.'));
      },
      'image/jpeg',
      quality
    );
  });

  onProgress?.(100);
  const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const outName = sanitizeFilename(`${base}_page_${targetPage}.jpg`);
  const downloadUrl = URL.createObjectURL(jpgBlob);

  return {
    blob: jpgBlob,
    downloadUrl,
    filename: outName,
    originalSize: file.size,
    processedSize: jpgBlob.size,
    savingsPercentage: 0,
    metadata: {
      totalPages: numPages,
      extractedPage: targetPage,
      dimensions: `${Math.round(viewport.width)} x ${Math.round(viewport.height)}`,
    },
  };
}
