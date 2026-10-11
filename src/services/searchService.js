const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const GOOGLE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const BRIGHTDATA_ENDPOINT = 'https://api.brightdata.com/request';

function isValidApiKey(key) {
  if (!key) return false;
  const trimmed = String(key).trim();
  if (!trimmed || trimmed === 'YOUR_BING_KEY_HERE' || (trimmed.startsWith('YOUR_') && trimmed.endsWith('_HERE'))) {
    return false;
  }
  return true;
}

function getSavedConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('attachSurferConfig');
      if (saved) return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return null;
}

export function getBrightDataApiKey() {
  const saved = getSavedConfig()?.brightDataApiKey;
  if (saved && String(saved).trim()) return String(saved).trim();
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRIGHTDATA_API_KEY) || '';
}

export function getBrightDataZone() {
  const saved = getSavedConfig()?.brightDataZone;
  if (saved && String(saved).trim()) return String(saved).trim();
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRIGHTDATA_ZONE) || 'serp_api1';
}

export function getGoogleApiKey() {
  const saved = getSavedConfig()?.googleApiKey;
  if (saved && String(saved).trim()) return String(saved).trim();
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_API_KEY) || '';
}

export function getGoogleCx() {
  const saved = getSavedConfig()?.googleCx;
  if (saved && String(saved).trim()) return String(saved).trim();
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CX) || '';
}

export function getBingApiKey() {
  const saved = getSavedConfig()?.bingApiKey;
  if (saved && String(saved).trim()) return String(saved).trim();
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BING_API_KEY) || '';
}

export function getBrightDataEndpoint() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRIGHTDATA_ENDPOINT) || 'https://api.brightdata.com/request';
}

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function normalizeTitleForDeduplication(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/\[(pdf|docx?|xlsx?|pptx?)\]/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Extract wrapped URLs from search redirect parameters (e.g. DuckDuckGo / BrightData / Google)
  const uddgMatch = trimmed.match(/[?&]uddg=([^&#]+)/);
  if (uddgMatch) {
    try { trimmed = decodeURIComponent(uddgMatch[1]); } catch { /* ignore */ }
  }
  if (trimmed.includes('/url?')) {
    const qMatch = trimmed.match(/[?&]q=([^&#]+)/);
    if (qMatch) {
      try { trimmed = decodeURIComponent(qMatch[1]); } catch { /* ignore */ }
    }
  }

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = 'https:';
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    parsed.hostname = hostname;
    parsed.hash = '';

    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'ref', 'source',
      'spm', '_ga', '_gl', 'mc_cid', 'mc_eid', 'yclid'
    ]);
    const keysToDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (trackingParams.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => parsed.searchParams.delete(k));
    parsed.searchParams.sort();

    let pathname = parsed.pathname.replace(/\/+/g, '/');
    pathname = pathname.replace(/\/(index|default)\.(html?|php|asp[x]?)$/i, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    return parsed.toString();
  } catch {
    return trimmed.split('#')[0].replace(/\/+$/, '');
  }
}

export function deduplicateResults(results) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const seen = new Map();
  const titleHostMap = new Map();

  for (const item of results) {
    if (!item) continue;
    const normKey = normalizeUrl(item.url) || item.url || item.title;
    if (!normKey) continue;

    let host = '';
    try {
      const u = new URL(item.url);
      host = u.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      host = '';
    }
    const cleanTitle = normalizeTitleForDeduplication(item.title);
    const titleHostKey = (host && cleanTitle.length >= 8) ? `${host}:::${cleanTitle}` : null;

    let existingKey = seen.has(normKey) ? normKey : (titleHostKey && titleHostMap.get(titleHostKey));

    if (!existingKey) {
      seen.set(normKey, {
        ...item,
        hasAttachment: item.hasAttachment || isAttachmentUrl(item.url, item.title, item.snippet)
      });
      if (titleHostKey) {
        titleHostMap.set(titleHostKey, normKey);
      }
    } else {
      const existing = seen.get(existingKey);
      if (item.engine && existing.engine && !existing.engine.includes(item.engine)) {
        existing.engine = `${existing.engine}, ${item.engine}`;
      }
      if ((!existing.snippet || existing.snippet.length < (item.snippet || '').length) && item.snippet) {
        existing.snippet = item.snippet;
      }
      if ((!existing.title || existing.title.length < (item.title || '').length) && item.title) {
        existing.title = item.title;
      }
      if (item.hasAttachment || isAttachmentUrl(item.url, item.title, item.snippet)) {
        existing.hasAttachment = true;
      }
    }
  }

  return Array.from(seen.values()).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
}

export function parseSerpHtml(html, resultCount = 3) {
  const results = [];
  if (!html) return results;

  // Pattern 1: DuckDuckGo HTML results
  const blocks = html.split(/class="result\s+/).slice(1);
  for (const block of blocks) {
    if (results.length >= resultCount) break;
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

    let url = titleMatch[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    else if (url.startsWith('//')) url = 'https:' + url;

    const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '').trim());
    const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    let displayUrl = url;
    try { displayUrl = new URL(url).hostname; } catch { displayUrl = url; }

    results.push({
      rank: results.length + 1,
      title,
      url,
      displayUrl,
      snippet,
      engine: 'BrightData'
    });
  }

  if (results.length > 0) return results;

  // Pattern 2: Google SERP HTML (h3 + link)
  const seen = new Set();
  const googleRegex = /<a\s+[^>]*?href="(https?:\/\/(?!www\.google\.[a-z]+|accounts\.google|support\.google)[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  while ((match = googleRegex.exec(html)) !== null && results.length < resultCount) {
    const url = match[1];
    const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (title && !seen.has(url)) {
      seen.add(url);
      let displayUrl = url;
      try { displayUrl = new URL(url).hostname; } catch { displayUrl = url; }
      results.push({
        rank: results.length + 1,
        title,
        url,
        displayUrl,
        snippet: '',
        engine: 'BrightData'
      });
    }
  }

  return results;
}

export async function searchGoogle(query, resultCount = 3) {
  const googleApiKey = getGoogleApiKey();
  const googleCx = getGoogleCx();

  if (!isValidApiKey(googleApiKey) || !googleCx) {
    throw new Error('Google API key or Search Engine ID (CX) not configured. Set VITE_GOOGLE_API_KEY and VITE_GOOGLE_CX in .env');
  }

  const params = new URLSearchParams({
    key: googleApiKey,
    cx: googleCx,
    q: query,
    num: String(resultCount)
  });

  const res = await fetch(`${GOOGLE_ENDPOINT}?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google API returned ${res.status}`);
  }

  const data = await res.json();
  return (data.items || []).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.link,
    displayUrl: item.displayLink,
    snippet: item.snippet || '',
    engine: 'Google'
  }));
}

export async function searchBing(query, resultCount = 3) {
  const bingApiKey = getBingApiKey();

  if (!isValidApiKey(bingApiKey)) {
    throw new Error('Bing API key not configured. Set VITE_BING_API_KEY in .env');
  }

  const params = new URLSearchParams({ q: query, count: String(resultCount) });

  const res = await fetch(`${BING_ENDPOINT}?${params}`, {
    headers: { 'Ocp-Apim-Subscription-Key': bingApiKey }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Bing API returned ${res.status}`);
  }

  const data = await res.json();
  return (data.webPages?.value || []).map((item, i) => ({
    rank: i + 1,
    title: item.name,
    url: item.url,
    displayUrl: item.displayUrl,
    snippet: item.snippet || '',
    engine: 'Bing'
  }));
}

export async function searchBrightData(query, resultCount = 3) {
  const apiKey = getBrightDataApiKey();
  const zone = getBrightDataZone();
  const endpoint = getBrightDataEndpoint();

  if (!isValidApiKey(apiKey)) {
    throw new Error('Bright Data API key not configured. Set VITE_BRIGHTDATA_API_KEY in .env');
  }

  // Query search endpoint through Bright Data SERP zone
  const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      zone,
      url: targetUrl,
      format: 'raw'
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errMsg = text;
    try {
      const err = JSON.parse(text);
      errMsg = err.message || err.error?.message || (typeof err.error === 'string' ? err.error : null) || text;
    } catch {
      // plain text error message (e.g. zone "serp" not found)
    }
    throw new Error(errMsg || `Bright Data API returned ${res.status}`);
  }

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // raw text / HTML response
  }

  // 1. If response is parsed JSON with organic items:
  let rawItems = [];
  if (data) {
    if (Array.isArray(data)) rawItems = data;
    else if (Array.isArray(data.organic)) rawItems = data.organic;
    else if (Array.isArray(data.organic_results)) rawItems = data.organic_results;
    else if (Array.isArray(data.results)) rawItems = data.results;
    else if (Array.isArray(data.items)) rawItems = data.items;
    else if (typeof data.body === 'string') {
      try {
        const bodyData = JSON.parse(data.body);
        if (Array.isArray(bodyData.organic)) rawItems = bodyData.organic;
        else if (Array.isArray(bodyData.results)) rawItems = bodyData.results;
      } catch {
        // body is HTML
      }
    }
  }

  if (rawItems.length > 0) {
    return rawItems.slice(0, resultCount).map((item, i) => {
      const url = item.link || item.url || '';
      let displayUrl = item.display_link || item.displayLink || item.displayUrl || '';
      if (!displayUrl && url) {
        try { displayUrl = new URL(url).hostname; } catch { displayUrl = url; }
      }

      return {
        rank: item.rank || i + 1,
        title: decodeHtmlEntities(item.title || item.name || ''),
        url,
        displayUrl,
        snippet: decodeHtmlEntities(item.description || item.snippet || (Array.isArray(item.snippet_highlighted_words) ? item.snippet_highlighted_words.join(' ') : '') || ''),
        engine: 'BrightData'
      };
    });
  }

  // 2. Parse HTML response
  const html = (data && typeof data.body === 'string') ? data.body : text;
  return parseSerpHtml(html, resultCount);
}

export async function search(query, engine = 'all', resultCount = 3, options = {}) {
  const hasBing = isValidApiKey(getBingApiKey());
  const hasGoogle = !!(isValidApiKey(getGoogleApiKey()) && getGoogleCx());
  const hasBrightData = isValidApiKey(getBrightDataApiKey());

  let engines = engine === 'all' ? ['bing', 'google', 'brightdata'] : [engine];
  engines = engines.filter(eng => {
    if (eng === 'bing') return hasBing;
    if (eng === 'google') return hasGoogle;
    if (eng === 'brightdata') return hasBrightData;
    return false;
  });

  if (engines.length === 0) {
    throw new Error('No search API keys configured. Add VITE_BING_API_KEY, VITE_GOOGLE_API_KEY + VITE_GOOGLE_CX, or VITE_BRIGHTDATA_API_KEY to .env');
  }

  // When attachment filter is 'with', query with filetype qualifier to help search engines find actual files
  let effectiveQuery = query;
  const attachmentFilter = options?.attachmentFilter;
  if (attachmentFilter === 'with' && !query.toLowerCase().includes('filetype:') && !/\b(pdf|docx?|xlsx?|pptx?|csv)\b/i.test(query)) {
    effectiveQuery = `${query} filetype:pdf`;
  }

  const allResults = [];

  const searches = engines.map(async (eng) => {
    try {
      if (eng === 'google') return await searchGoogle(effectiveQuery, resultCount);
      if (eng === 'brightdata') return await searchBrightData(effectiveQuery, resultCount);
      return await searchBing(effectiveQuery, resultCount);
    } catch (err) {
      console.error(`Search failed for ${eng}:`, err);
      return [];
    }
  });

  const results = await Promise.allSettled(searches);
  results.forEach((r) => {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  });

  // If query with filetype:pdf returned no results, retry with original query as fallback
  if (allResults.length === 0 && effectiveQuery !== query) {
    const fallbackSearches = engines.map(async (eng) => {
      try {
        if (eng === 'google') return await searchGoogle(query, resultCount);
        if (eng === 'brightdata') return await searchBrightData(query, resultCount);
        return await searchBing(query, resultCount);
      } catch {
        return [];
      }
    });
    const fallbackResults = await Promise.allSettled(fallbackSearches);
    fallbackResults.forEach((r) => {
      if (r.status === 'fulfilled') allResults.push(...r.value);
    });
  }

  return deduplicateResults(allResults);
}

export function isAttachmentUrl(url, title = '', snippet = '') {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0];
  const attachmentPatterns = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|tar\.gz|7z)(\?.*)?$/i;

  if (attachmentPatterns.test(cleanUrl) || attachmentPatterns.test(url)) {
    return true;
  }

  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('/pdf/') ||
    lowerUrl.includes('/attachment') ||
    lowerUrl.includes('/attachments/') ||
    lowerUrl.includes('/document') ||
    lowerUrl.includes('/documents/') ||
    lowerUrl.includes('/file') ||
    lowerUrl.includes('/files/') ||
    lowerUrl.includes('/download/') ||
    lowerUrl.includes('format=pdf') ||
    lowerUrl.includes('type=pdf')
  ) {
    return true;
  }

  if (/\[(PDF|DOC|DOCX|XLS|XLSX|PPT|PPTX)\]/i.test(title)) return true;
  if (/^(PDF|DOC|XLS|PPT)\b/i.test(title)) return true;
  if (/\bfile format:\s*(pdf|docx?|xlsx?)\b/i.test(snippet)) return true;

  return false;
}

export function filterByAttachment(results, filter) {
  if (!results) return [];
  const deduped = deduplicateResults(results);
  if (filter === 'all') return deduped;

  const filtered = deduped.filter(r => {
    const hasAttachment = isAttachmentUrl(r.url, r.title, r.snippet);
    return filter === 'with' ? hasAttachment : !hasAttachment;
  });

  return deduplicateResults(filtered);
}
