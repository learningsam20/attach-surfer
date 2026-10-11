import { extractText } from './attachmentExtractor';
import { performOCR } from './ocrService';
import {
  ensureUser,
  createRun,
  updateRun,
  addFile,
  addOutput,
  generateEmbedding,
  searchFiles,
  searchOutputs,
  getRunFiles,
  getRunOutputs
} from '../db/rxdb';

const DEFAULT_USER_ID = 'default';

export async function ingestUrl(url, runId, onProgress) {
  onProgress?.(`Fetching ${url}...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  const filename = url.split('/').pop().split('?')[0] || 'unknown';
  const ext = filename.split('.').pop().toLowerCase();

  const isAttachment = /\.(pdf|docx?|xlsx?|pptx?|csv|txt)$/i.test(url) ||
    contentType.includes('application/pdf') ||
    contentType.includes('officedocument');

  if (!isAttachment) {
    const html = await res.text();
    const { convertHtmlToMarkdown } = await import('./htmlConverter');
    const markdown = convertHtmlToMarkdown(html);

    const embedding = await generateEmbedding(markdown);
    const file = await addFile(runId, DEFAULT_USER_ID, {
      url,
      filename,
      type: 'page',
      mimeType: contentType,
      content: markdown,
      embedding
    });

    return { file, type: 'page' };
  }

  const arrayBuffer = await res.arrayBuffer();
  const size = arrayBuffer.byteLength;

  onProgress?.(`Extracting text from ${filename}...`);
  const content = await extractText(filename, contentType, arrayBuffer);

  let ocrContent = null;
  if (ext === 'pdf' && content.length < 100) {
    onProgress?.('Performing OCR on PDF...');
    ocrContent = await performOCR(arrayBuffer, onProgress);
  }

  const fullContent = ocrContent ? `${content}\n\n${ocrContent}` : content;
  const embedding = await generateEmbedding(fullContent);

  const file = await addFile(runId, DEFAULT_USER_ID, {
    url,
    filename,
    type: 'attachment',
    mimeType: contentType,
    size,
    content: fullContent,
    ocrContent,
    embedding
  });

  return { file, type: 'attachment' };
}

export async function ingestMultipleUrls(urls, query, engine, onProgress) {
  await ensureUser(DEFAULT_USER_ID);

  const run = await createRun(DEFAULT_USER_ID, query, engine);
  const runId = run.id;

  onProgress?.(`Created run ${runId}`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress?.(`Processing ${i + 1}/${urls.length}: ${url}`);

    try {
      const result = await ingestUrl(url, runId, onProgress);
      results.push({ url, ...result, success: true });
    } catch (err) {
      console.error(`Failed to ingest ${url}:`, err);
      results.push({ url, success: false, error: err.message });
    }
  }

  await updateRun(runId, {
    status: 'completed',
    completedAt: Date.now()
  });

  return { runId, results };
}

export async function searchIngestedContent(query, limit = 10) {
  const queryEmbedding = await generateEmbedding(query);

  const [files, outputs] = await Promise.all([
    searchFiles(DEFAULT_USER_ID, queryEmbedding, limit),
    searchOutputs(DEFAULT_USER_ID, queryEmbedding, limit)
  ]);

  return {
    files: files.map(f => {
      const doc = typeof f.toJSON === 'function' ? f.toJSON() : (f._data || f);
      return {
        id: doc.id || f.id || `file_${Math.random().toString(36).slice(2, 7)}`,
        url: doc.url || f.url || '',
        filename: doc.filename || f.filename || (doc.url ? doc.url.split('/').pop() : 'Document'),
        type: doc.type || f.type || 'page',
        content: doc.content || f.content || '',
        score: f.score ?? doc.score ?? 0,
        createdAt: doc.createdAt || f.createdAt || Date.now()
      };
    }),
    outputs: outputs.map(o => {
      const doc = typeof o.toJSON === 'function' ? o.toJSON() : (o._data || o);
      return {
        id: doc.id || o.id || `output_${Math.random().toString(36).slice(2, 7)}`,
        type: doc.type || o.type || 'summary',
        content: doc.content || o.content || '',
        score: o.score ?? doc.score ?? 0,
        createdAt: doc.createdAt || o.createdAt || Date.now()
      };
    })
  };
}

export async function getRunDetails(runId) {
  const [files, outputs] = await Promise.all([
    getRunFiles(runId),
    getRunOutputs(runId)
  ]);

  return { files, outputs };
}

export async function saveSummary(runId, summary) {
  const embedding = await generateEmbedding(summary);
  return addOutput(runId, DEFAULT_USER_ID, {
    type: 'summary',
    content: summary,
    embedding
  });
}
