import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

if (typeof Promise.try !== 'function') {
  Promise.try = function (fn, ...args) {
    return new Promise(resolve => resolve(fn(...args)));
  };
}

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
if (typeof window !== 'undefined' && !isNode) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export function isPdfBuffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 5) return false;
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 1024)));
  let headerStr = '';
  for (let i = 0; i < headerBytes.length; i++) {
    headerStr += String.fromCharCode(headerBytes[i]);
  }
  return headerStr.includes('%PDF-');
}

import TurndownService from 'turndown';

export async function extractTextFromPDF(arrayBuffer) {
  if (!isPdfBuffer(arrayBuffer)) {
    throw new Error('Buffer is not a valid PDF binary (%PDF- header missing).');
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      if (pageText.trim()) {
        fullText += `### Page ${i}\n\n${pageText.trim()}\n\n`;
      }
    }

    return fullText.trim();
  } catch (err) {
    console.warn('PDF text extraction error:', err);
    throw err;
  }
}

export async function extractTextFromDOCX(arrayBuffer) {
  try {
    const options = {
      convertImage: mammoth.images?.imgElement ? mammoth.images.imgElement(image => {
        return image.read('base64').then(imageBuffer => ({
          src: `data:${image.contentType};base64,${imageBuffer}`
        }));
      }) : undefined
    };
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, options);
    if (html && html.trim()) {
      const turndown = new TurndownService({ headingStyle: 'atx', hr: '---' });
      return turndown.turndown(html).trim();
    }
  } catch {
    // fallback
  }
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

export async function extractTextFromXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows || rows.length === 0) continue;

    fullText += `### Sheet: ${sheetName}\n\n`;
    const headers = (rows[0] || []).map(h => String(h || '').trim() || '-');
    if (headers.length === 0) continue;

    fullText += `| ${headers.join(' | ')} |\n`;
    fullText += `| ${headers.map(() => '---').join(' | ')} |\n`;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const cells = headers.map((_, colIdx) => {
        const val = row[colIdx];
        return String(val !== undefined && val !== null ? val : '').replace(/\|/g, '\\|').trim() || ' ';
      });
      fullText += `| ${cells.join(' | ')} |\n`;
    }
    fullText += '\n';
  }

  return fullText.trim() || '*(Empty spreadsheet)*';
}

export async function extractTextFromPPTX(arrayBuffer) {
  const text = new TextDecoder().decode(arrayBuffer);
  const matches = text.match(/<a:t>([^<]+)<\/a:t>/g);
  if (matches) {
    return matches.map(m => m.replace(/<[^>]+>/g, '')).join('\n');
  }
  return 'Could not extract text from PPTX file';
}

export async function extractTextFromCSV(arrayBuffer) {
  const text = new TextDecoder().decode(arrayBuffer);
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return text.trim();

  try {
    const rows = lines.map(line => line.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));
    const headers = rows[0];
    let mdTable = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = headers.map((_, idx) => (row[idx] || '').replace(/\|/g, '\\|') || ' ');
      mdTable += `| ${cells.join(' | ')} |\n`;
    }
    return mdTable;
  } catch {
    return text.trim();
  }
}

export async function extractTextFromTXT(arrayBuffer) {
  const text = new TextDecoder().decode(arrayBuffer);
  return text.trim();
}

export async function extractText(filename, mimeType, arrayBuffer) {
  const ext = filename.split('.').pop().toLowerCase();

  try {
    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return await extractTextFromPDF(arrayBuffer);
    }
    if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(arrayBuffer);
    }
    if (ext === 'doc' || mimeType === 'application/msword') {
      return 'Legacy .doc format not supported. Please convert to .docx';
    }
    if (ext === 'xlsx' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return await extractTextFromXLSX(arrayBuffer);
    }
    if (ext === 'xls' || mimeType === 'application/vnd.ms-excel') {
      return 'Legacy .xls format not supported. Please convert to .xlsx';
    }
    if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return await extractTextFromPPTX(arrayBuffer);
    }
    if (ext === 'csv' || mimeType === 'text/csv') {
      return await extractTextFromCSV(arrayBuffer);
    }
    if (ext === 'txt' || mimeType === 'text/plain') {
      return await extractTextFromTXT(arrayBuffer);
    }
    return `Unsupported file type: .${ext}`;
  } catch (err) {
    console.error(`Failed to extract text from ${filename}:`, err);
    return `Failed to extract text: ${err.message}`;
  }
}

export async function extractPageAsImage(_pageNum = 1) {
  return null;
}

export async function pdfToImages(arrayBuffer, maxPages = 5) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  const pageCount = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;

    const imageData = canvas.toDataURL('image/png');
    images.push({ page: i, imageData });
  }

  return images;
}
