const BING_API_KEY = import.meta.env.VITE_BING_API_KEY || '';
const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GOOGLE_CX = import.meta.env.VITE_GOOGLE_CX || '';
const GOOGLE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

async function searchGoogle(query, resultCount = 3) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    throw new Error('Google API key or Search Engine ID (CX) not configured. Set VITE_GOOGLE_API_KEY and VITE_GOOGLE_CX in .env');
  }

  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CX,
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

async function searchBing(query, resultCount = 3) {
  if (!BING_API_KEY) {
    throw new Error('Bing API key not configured. Set VITE_BING_API_KEY in .env');
  }

  const params = new URLSearchParams({ q: query, count: String(resultCount) });

  const res = await fetch(`${BING_ENDPOINT}?${params}`, {
    headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY }
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

export async function search(query, engine = 'all', resultCount = 3) {
  const hasBing = !!import.meta.env.VITE_BING_API_KEY;
  const hasGoogle = !!(import.meta.env.VITE_GOOGLE_API_KEY && import.meta.env.VITE_GOOGLE_CX);

  let engines = engine === 'all' ? ['bing', 'google'] : [engine];
  engines = engines.filter(eng => {
    if (eng === 'bing') return hasBing;
    if (eng === 'google') return hasGoogle;
    return false;
  });

  if (engines.length === 0) {
    throw new Error('No search API keys configured. Add VITE_BING_API_KEY or VITE_GOOGLE_API_KEY + VITE_GOOGLE_CX to .env');
  }

  const allResults = [];

  const searches = engines.map(async (eng) => {
    try {
      if (eng === 'google') return await searchGoogle(query, resultCount);
      return await searchBing(query, resultCount);
    } catch (err) {
      console.error(`Search failed for ${eng}:`, err);
      return [];
    }
  });

  const results = await Promise.allSettled(searches);
  results.forEach((r) => {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  });

  return allResults;
}

export function filterByAttachment(results, filter) {
  if (filter === 'all') return results;

  const attachmentPatterns = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i;

  return results.filter(r => {
    const hasAttachment = attachmentPatterns.test(r.url) ||
      r.url.includes('/attachment') ||
      r.url.includes('/document') ||
      r.url.includes('/file');

    return filter === 'with' ? hasAttachment : !hasAttachment;
  });
}
