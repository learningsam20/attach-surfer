import TurndownService from 'turndown';
import { extractText, extractTextFromPDF, isPdfBuffer } from './attachmentExtractor.js';
import { getBrightDataApiKey, getBrightDataZone } from './searchService.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']);

export function prepareContentElement(element, docUrl) {
  if (!element) return;

  const images = element.querySelectorAll('img');
  images.forEach(img => {
    let rawSrc = img.getAttribute('data-src') ||
                 img.getAttribute('data-original') ||
                 img.getAttribute('data-lazy-src') ||
                 img.getAttribute('src') || '';

    if ((!rawSrc || rawSrc.startsWith('data:image/svg') || rawSrc.startsWith('data:image/gif')) && img.getAttribute('srcset')) {
      const candidates = img.getAttribute('srcset').split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
      if (candidates.length > 0) {
        rawSrc = candidates[candidates.length - 1];
      }
    }

    if (rawSrc && !rawSrc.startsWith('data:') && !rawSrc.startsWith('blob:')) {
      try {
        const absoluteUrl = new URL(rawSrc, docUrl).href;
        img.setAttribute('src', absoluteUrl);
      } catch {
        // fallback
      }
    } else if (rawSrc) {
      img.setAttribute('src', rawSrc);
    }

    if (!img.getAttribute('alt')) {
      img.setAttribute('alt', img.getAttribute('title') || 'Document image');
    }
  });

  const links = element.querySelectorAll('a');
  links.forEach(a => {
    const rawHref = a.getAttribute('href');
    if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:') && !rawHref.startsWith('mailto:')) {
      try {
        a.setAttribute('href', new URL(rawHref, docUrl).href);
      } catch {
        // fallback
      }
    }
  });
}

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

export async function fetchWithProxy(url) {
  // 1. Try local dev CORS proxy if in browser environment
  if (!isNode && typeof window !== 'undefined' && window.location?.origin) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
    } catch {
      // fallback
    }
  }

  // 2. Try Bright Data SERP/request proxy if configured
  const apiKey = getBrightDataApiKey();
  const zone = getBrightDataZone();
  if (apiKey && !isNode) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone,
          url,
          format: 'raw'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
    } catch {
      // fallback
    }
  }

  // 3. Try public CORS proxy fallback in browser
  if (!isNode && typeof window !== 'undefined') {
    const publicProxies = [
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
    ];
    for (const makeProxy of publicProxies) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(makeProxy(url), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return res;
      } catch {
        // continue
      }
    }
  }

  // 4. Try direct fetch (in Node or if same-origin / local URL)
  const isSameOrigin = !isNode && typeof window !== 'undefined' && (
    url.startsWith('/') ||
    (window.location?.origin && url.startsWith(window.location.origin))
  );

  if (isNode || isSameOrigin) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // 5. Final fallback for cross-origin URLs in browser:
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch {
    throw new Error(`Failed to fetch ${url} due to CORS policy or upstream network failure`);
  }
}

export async function extractPageContent(url, fallbackSnippet = '') {
  const isAttachment = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)(\?.*)?$/i.test(url) || url.includes('/pdf/');
  const filename = url.split('/').pop().split('?')[0] || 'document';
  const ext = filename.split('.').pop().toLowerCase();

  const mimeMap = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    txt: 'text/plain'
  };
  const mimeType = mimeMap[ext] || (isAttachment ? 'application/octet-stream' : '');

  if (isAttachment) {
    try {
      const res = await fetchWithProxy(url);
      if (res && res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          const isPdf = ext === 'pdf' || url.includes('/pdf/');
          let text = '';

          if (isPdf) {
            if (isPdfBuffer(buffer)) {
              text = await extractTextFromPDF(buffer);
            } else {
              // The host returned an HTML abstract/challenge page instead of raw PDF
              const htmlText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
              if (htmlText.includes('<html') || htmlText.includes('<!DOCTYPE') || htmlText.includes('<body')) {
                const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                const pageTitle = doc.querySelector('title')?.textContent?.trim() || filename;
                const mainContent = doc.querySelector('main, article, [role="main"], .publication-content, .content, #content') || doc.querySelector('body');
                if (mainContent) {
                  prepareContentElement(mainContent, url);
                }
                let pageMd = mainContent ? turndown.turndown(mainContent.innerHTML) : '';
                pageMd = pageMd.replace(/\n{3,}/g, '\n\n').trim();

                const isBlocked = pageMd.toLowerCase().includes('cloudflare') || pageMd.toLowerCase().includes('please enable cookies');
                if (pageMd && !isBlocked && pageMd.length > 50) {
                  return {
                    url,
                    type: 'attachment',
                    filename,
                    title: pageTitle,
                    markdown: `# ${pageTitle}\n\n${pageMd}\n\n---\n*[Direct PDF link](${url})*`,
                    success: true
                  };
                }
              }
            }
          } else {
            text = await extractText(filename, mimeType, buffer);
          }

          if (text && text.trim().length > 0 && !text.startsWith('Could not') && !text.startsWith('Unsupported')) {
            const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
            return {
              url,
              type: 'attachment',
              filename,
              title: filename,
              markdown: `# ${filename}\n\n${cleanText}`,
              success: true
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Could not extract binary attachment from ${url}:`, err?.message || err);
    }

    return {
      url,
      type: 'attachment',
      filename,
      title: filename,
      markdown: fallbackSnippet
        ? `# ${filename}\n\n*Attachment detected (${(ext || 'PDF').toUpperCase()})*\n\n${fallbackSnippet}\n\n---\n*[Open / Download full document](${url})*`
        : `# ${filename}\n\n*Attachment detected (${(ext || 'PDF').toUpperCase()})*\n\nThis is a binary file. [Download / View file](${url})`,
      success: true
    };
  }

  try {
    const res = await fetchWithProxy(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const pdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      try {
        const buffer = await res.arrayBuffer();
        const text = await extractTextFromPDF(buffer);
        if (text && text.trim().length > 0) {
          const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
          return {
            url,
            type: 'attachment',
            filename: pdfName,
            title: pdfName,
            markdown: `# ${pdfName}\n\n${cleanText}`,
            success: true
          };
        }
      } catch {
        // fallback
      }
      return {
        url,
        type: 'attachment',
        filename: pdfName,
        title: pdfName,
        markdown: fallbackSnippet
          ? `# ${pdfName}\n\n${fallbackSnippet}`
          : `# ${pdfName}\n\n*(PDF without extractable text. [View PDF directly](${url}))*`,
        success: true
      };
    }

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const mainContent = doc.querySelector('main, article, [role="main"], .content, .post-content, .entry-content, #content')
      || doc.querySelector('body');

    let markdown = '';
    if (mainContent) {
      prepareContentElement(mainContent, url);
      markdown = turndown.turndown(mainContent.innerHTML);
    }

    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    return { url, type: 'page', title, markdown: markdown || fallbackSnippet || '*No text content found on page.*', success: true };
  } catch (err) {
    console.warn(`Failed to extract content from ${url}:`, err);
    return {
      url,
      type: 'error',
      title: '',
      markdown: fallbackSnippet
        ? `${fallbackSnippet}\n\n*(Full web page content could not be retrieved directly: ${err.message})*`
        : `Could not extract content (${err.message}). Open the link directly to view the page.`,
      success: false
    };
  }
}
