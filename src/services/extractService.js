import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']);

export async function extractPageContent(url) {
  const isAttachment = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i.test(url);

  if (isAttachment) {
    return {
      url,
      type: 'attachment',
      filename: url.split('/').pop().split('?')[0],
      markdown: `*Attachment detected: ${url.split('/').pop().split('?')[0]}*\n\nThis is a binary file. Open the link directly to view or download it.`,
      success: true
    };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      return {
        url,
        type: 'attachment',
        filename: url.split('/').pop().split('?')[0] || 'document.pdf',
        markdown: `*PDF document detected.*\n\nOpen the link directly to view this PDF.`,
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
      markdown = turndown.turndown(mainContent.innerHTML);
    }

    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    const maxLen = 3000;
    if (markdown.length > maxLen) {
      markdown = markdown.substring(0, maxLen) + '\n\n*[Content truncated...]*';
    }

    return { url, type: 'page', title, markdown, success: true };
  } catch (err) {
    console.error(`Failed to extract content from ${url}:`, err);
    return {
      url,
      type: 'error',
      markdown: `Could not extract content (${err.message}). Open the link directly to view the page.`,
      success: false
    };
  }
}
