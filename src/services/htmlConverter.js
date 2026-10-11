import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']);

export function convertHtmlToMarkdown(html) {
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

  const maxLen = 5000;
  if (markdown.length > maxLen) {
    markdown = markdown.substring(0, maxLen) + '\n\n*[Content truncated...]*';
  }

  return { title, markdown };
}
