import { getWebLLMEngine } from '../utils/webllmEngine';
import { pdfToImages } from './attachmentExtractor';

export async function performOCR(arrayBuffer, onProgress) {
  onProgress?.('Converting PDF pages to images...');

  try {
    const images = await pdfToImages(arrayBuffer, 5);

    if (images.length === 0) {
      return 'No pages found in PDF';
    }

    onProgress?.('Loading vision model for OCR...');

    const engine = await getWebLLMEngine((progress) => {
      onProgress?.(progress);
    });

    let fullText = '';

    for (let i = 0; i < images.length; i++) {
      const { page, imageData } = images[i];
      onProgress?.(`Processing page ${page} of ${images.length}...`);

      const response = await engine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an OCR engine. Extract all text from the image. Return only the extracted text, preserving the layout and structure. If the image contains tables, format them as markdown tables.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extract all text from this page (page ${page}):` },
              { type: 'image_url', image_url: { url: imageData } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const pageText = response.choices[0]?.message?.content || '';
      fullText += `\n\n--- Page ${page} ---\n\n${pageText}`;
    }

    return fullText.trim();
  } catch (err) {
    console.error('OCR failed:', err);
    throw new Error(`OCR failed: ${err.message}`, { cause: err });
  }
}

export async function extractPDFContent(arrayBuffer, onProgress) {
  const { extractTextFromPDF } = await import('./attachmentExtractor');

  onProgress?.('Extracting text from PDF...');
  const textContent = await extractTextFromPDF(arrayBuffer);

  if (textContent.length > 100) {
    onProgress?.('Text extraction complete');
    return { text: textContent, ocr: null };
  }

  onProgress?.('Little or no text found, performing OCR...');
  const ocrContent = await performOCR(arrayBuffer, onProgress);

  return { text: textContent, ocr: ocrContent };
}
