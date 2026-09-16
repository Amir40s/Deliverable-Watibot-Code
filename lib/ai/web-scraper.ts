/**
 * Web Scraper & HTML Content Extractor for AI Knowledge Base
 * Safely fetches web pages, strips noise/scripts/styles, and extracts structured text/markdown
 * for accurate AI RAG responses on WhatsApp.
 */

export interface ScrapedPageResult {
  url: string;
  title: string;
  description?: string;
  content: string;
  charCount: number;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

/**
 * Normalizes and validates a given URL
 */
export function normalizeUrl(inputUrl: string): string {
  let url = inputUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    // Remove unnecessary tracking hash or UTM params for cleaner indexing
    parsed.hash = '';
    return parsed.toString();
  } catch (err: any) {
    throw new Error(`Invalid website URL: ${inputUrl}`);
  }
}

/**
 * Cleans raw HTML and converts to readable Markdown/Text for AI consumption
 */
export function cleanHtmlToMarkdown(html: string, pageUrl: string): { title: string; description: string; content: string } {
  let workingHtml = html;

  // 1. Extract Page Title
  let title = '';
  const titleMatch = workingHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = decodeHtmlEntities(titleMatch[1].trim());
  }

  if (!title) {
    const ogTitle = workingHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    if (ogTitle && ogTitle[1]) {
      title = decodeHtmlEntities(ogTitle[1].trim());
    }
  }

  if (!title) {
    try {
      const u = new URL(pageUrl);
      title = u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      title = pageUrl;
    }
  }

  // 2. Extract Meta Description
  let description = '';
  const metaDesc = workingHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    workingHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  if (metaDesc && metaDesc[1]) {
    description = decodeHtmlEntities(metaDesc[1].trim());
  }

  // 3. Extract JSON-LD structured FAQs, Products & Menus
  const structuredDataSnippets: string[] = [];

  // Extract Next.js __NEXT_DATA__, SPA State & Embedded Product Catalogs
  try {
    const embeddedStateSnippets = extractDataFromEmbeddedScripts(workingHtml);
    if (embeddedStateSnippets.length > 0) {
      structuredDataSnippets.push(...embeddedStateSnippets);
    }
  } catch {
    // Ignore embedded script errors
  }

  // Extract JSON-LD Schemas (ItemList, Product, Restaurant/Menu, FAQPage)
  const jsonLdMatches = workingHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const rawJson = JSON.parse(match[1]);
      const items: any[] = [];

      if (Array.isArray(rawJson)) {
        items.push(...rawJson);
      } else if (rawJson['@graph'] && Array.isArray(rawJson['@graph'])) {
        items.push(...rawJson['@graph']);
      } else {
        items.push(rawJson);
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        // ItemList (Menu Categories / Product Catalog List)
        if (item['@type'] === 'ItemList' || Array.isArray(item.itemListElement)) {
          const listName = item.name || 'Categories & Items';
          const elements = Array.isArray(item.itemListElement) ? item.itemListElement : [];
          if (elements.length > 0) {
            structuredDataSnippets.push(`### ${decodeHtmlEntities(listName)}:`);
            for (const el of elements) {
              const name = el.name || el.item?.name || el.title;
              const url = el.url || el.item?.url;
              const desc = el.description || el.item?.description;
              const price = el.price || el.offers?.price || el.item?.offers?.price;
              
              if (name) {
                let line = `- **${decodeHtmlEntities(name)}**`;
                if (price) line += `: Rs. ${price}`;
                if (desc) line += ` — ${decodeHtmlEntities(stripAllTags(desc))}`;
                if (url && !url.startsWith('#')) line += ` (Link: ${url})`;
                structuredDataSnippets.push(line);
              }
            }
          }
        }

        // Product Schema
        if (item['@type'] === 'Product') {
          const pName = item.name;
          const pDesc = item.description;
          const price = item.offers?.price || item.offers?.[0]?.price;
          const currency = item.offers?.priceCurrency || item.offers?.[0]?.priceCurrency || 'Rs.';
          if (pName) {
            structuredDataSnippets.push(`### Product: ${decodeHtmlEntities(pName)}`);
            if (price) structuredDataSnippets.push(`- Price: ${currency} ${price}`);
            if (pDesc) structuredDataSnippets.push(`- Description: ${decodeHtmlEntities(stripAllTags(pDesc))}`);
          }
        }

        // Restaurant / Menu Schema
        if (item['@type'] === 'Restaurant' || item['@type'] === 'Menu' || item['@type'] === 'FoodEstablishment') {
          const menuSections = item.hasMenuSection || item.hasMenuItem || item.menu || [];
          const list = Array.isArray(menuSections) ? menuSections : [menuSections];
          for (const s of list) {
            if (!s) continue;
            const secName = s.name || 'Menu Section';
            structuredDataSnippets.push(`### ${decodeHtmlEntities(secName)}:`);
            const subItems = s.hasMenuItem || s.itemListElement || (Array.isArray(s) ? s : []);
            if (Array.isArray(subItems)) {
              for (const m of subItems) {
                const mName = m.name || m.title;
                const mPrice = m.offers?.price || m.price;
                const mDesc = m.description;
                if (mName) {
                  let mLine = `- **${decodeHtmlEntities(mName)}**`;
                  if (mPrice) mLine += `: Rs. ${mPrice}`;
                  if (mDesc) mLine += ` — ${decodeHtmlEntities(stripAllTags(mDesc))}`;
                  structuredDataSnippets.push(mLine);
                }
              }
            }
          }
        }

        // FAQPage Schema
        if (item['@type'] === 'FAQPage' && Array.isArray(item.mainEntity)) {
          structuredDataSnippets.push('### Frequently Asked Questions (FAQ):');
          for (const q of item.mainEntity) {
            const question = q.name || q.text;
            const answer = q.acceptedAnswer?.text || q.acceptedAnswer?.name;
            if (question && answer) {
              structuredDataSnippets.push(`**Q: ${decodeHtmlEntities(question)}**\nA: ${decodeHtmlEntities(stripAllTags(answer))}\n`);
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in inline scripts
    }
  }

  // 4. Strip unwanted blocks (scripts, styles, nav, footer, ads, svg, iframe)
  workingHtml = workingHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' '); // Comments

  // 5. Convert structural HTML to Markdown
  workingHtml = workingHtml
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
    .replace(/<h[56][^>]*>([\s\S]*?)<\/h[56]>/gi, '\n\n##### $1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gi, '\n**$1**: ')
    .replace(/<dd[^>]*>([\s\S]*?)<\/dd>/gi, '$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ');

  // 6. Strip all remaining HTML tags
  let text = stripAllTags(workingHtml);

  // 7. Decode HTML entities & Normalize spacing
  text = decodeHtmlEntities(text);

  // Clean lines and remove repetitive blank spaces
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let cleanedContent = lines.join('\n');

  // Collapse multiple consecutive newlines
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');

  // Prepend Structured Data if any was extracted
  if (structuredDataSnippets.length > 0) {
    cleanedContent = `${structuredDataSnippets.join('\n\n')}\n\n---\n\n${cleanedContent}`;
  }

  // Prepend metadata header
  const headerParts = [`Source URL: ${pageUrl}`];
  if (title) headerParts.push(`Page Title: ${title}`);
  if (description) headerParts.push(`Description: ${description}`);

  const fullContent = `${headerParts.join('\n')}\n\n${cleanedContent}`.trim();

  return {
    title,
    description,
    content: fullContent,
  };
}

/**
 * Strips all HTML tags from a string
 */
function stripAllTags(input: string): string {
  return input.replace(/<[^>]*>?/gm, '');
}

/**
 * Decodes common HTML entities
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--')
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®');
}

/**
 * Extracts product catalogs, menu items, categories, pricing, and structured data
 * from embedded SPA script tags like Next.js (__NEXT_DATA__), Nuxt, and inline state.
 */
export function extractDataFromEmbeddedScripts(html: string): string[] {
  const snippets: string[] = [];
  const seenItems = new Set<string>();

  // 1. Next.js __NEXT_DATA__ extraction
  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch && nextDataMatch[1]) {
    try {
      const nextJson = JSON.parse(nextDataMatch[1]);
      const extracted = extractStructuredFromObject(nextJson.props?.pageProps || nextJson, seenItems);
      if (extracted.length > 0) {
        snippets.push(...extracted);
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  // 2. Generic script tags with type="application/json" (excluding JSON-LD which is handled separately)
  const genericJsonMatches = html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of genericJsonMatches) {
    if (match[0].includes('__NEXT_DATA__')) continue;
    try {
      const parsed = JSON.parse(match[1]);
      const extracted = extractStructuredFromObject(parsed, seenItems);
      if (extracted.length > 0) {
        snippets.push(...extracted);
      }
    } catch {
      // Ignore
    }
  }

  // 3. window.__INITIAL_STATE__ or window.__DATA__ in inline script
  const windowStateMatches = html.matchAll(/window\.__[A-Z0-9_]+__\s*=\s*(\{[\s\S]*?\});/gi);
  for (const match of windowStateMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const extracted = extractStructuredFromObject(parsed, seenItems);
      if (extracted.length > 0) {
        snippets.push(...extracted);
      }
    } catch {
      // Ignore
    }
  }

  return snippets;
}

/**
 * Recursively extracts categories, products, menu items, prices, and FAQs from arbitrary JSON structures
 */
function extractStructuredFromObject(rootObj: any, seenItems: Set<string>, depth: number = 0): string[] {
  if (!rootObj || typeof rootObj !== 'object' || depth > 8) {
    return [];
  }

  const results: string[] = [];

  // Helper to extract product item info
  const tryFormatItem = (item: any): string | null => {
    if (!item || typeof item !== 'object') return null;
    const name = item.name || item.title || item.itemTitle || item.productName || item.dishName;
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 120) return null;

    const normalizedName = name.trim().toLowerCase();
    if (seenItems.has(normalizedName)) return null;

    const price = item.price || item.finalPrice || item.actualPrice || item.amount || item.offers?.price;
    const currency = item.currency || item.offers?.priceCurrency || 'Rs.';
    const desc = item.description || item.itemDescription || item.shortDescription || item.details;

    // Only consider it a product/item if it has a price or description or is in a catalog array
    if (price !== undefined || desc) {
      seenItems.add(normalizedName);
      let line = `- **${decodeHtmlEntities(name.trim())}**`;
      if (price !== undefined && price !== null) {
        line += `: ${currency} ${price}`;
      }
      if (desc && typeof desc === 'string') {
        line += ` — ${decodeHtmlEntities(stripAllTags(desc.trim()))}`;
      }
      return line;
    }
    return null;
  };

  // Check if object is an array of items
  if (Array.isArray(rootObj)) {
    for (const el of rootObj) {
      const itemLine = tryFormatItem(el);
      if (itemLine) {
        results.push(itemLine);
      } else if (typeof el === 'object') {
        results.push(...extractStructuredFromObject(el, seenItems, depth + 1));
      }
    }
    return results;
  }

  // Check if object represents a category with items
  const categoryName = rootObj.name || rootObj.categoryName || rootObj.categoryTitle || rootObj.title;
  const itemsArray = rootObj.items || rootObj.products || rootObj.menuItems || rootObj.dishes || rootObj.elements || rootObj.data;

  if (typeof categoryName === 'string' && Array.isArray(itemsArray) && itemsArray.length > 0) {
    const categoryItems: string[] = [];
    for (const it of itemsArray) {
      const line = tryFormatItem(it);
      if (line) {
        categoryItems.push(line);
      }
    }

    if (categoryItems.length > 0) {
      results.push(`### Category: ${decodeHtmlEntities(categoryName.trim())}`);
      results.push(...categoryItems);
      return results;
    }
  }

  // Check for FAQ question/answer format
  if (rootObj.question && (rootObj.answer || rootObj.acceptedAnswer)) {
    const q = rootObj.question;
    const a = rootObj.answer || rootObj.acceptedAnswer?.text || rootObj.acceptedAnswer;
    if (typeof q === 'string' && typeof a === 'string') {
      results.push(`**Q: ${decodeHtmlEntities(q.trim())}**\nA: ${decodeHtmlEntities(stripAllTags(a.trim()))}\n`);
      return results;
    }
  }

  // Recurse down keys of the object
  for (const key of Object.keys(rootObj)) {
    // Avoid noisy keys
    if (['css', 'styles', 'icons', 'analytics', 'tracking', 'svg', 'chunks', 'page'].includes(key.toLowerCase())) {
      continue;
    }
    const val = rootObj[key];
    if (val && typeof val === 'object') {
      results.push(...extractStructuredFromObject(val, seenItems, depth + 1));
    }
  }

  return results;
}

/**
 * Discovers internal links from a page's HTML within the same origin
 */
export function extractInternalLinks(html: string, baseUrl: string, maxLinks: number = 6): string[] {
  try {
    const baseObj = new URL(baseUrl);
    const linksFound = new Set<string>();
    const linkMatches = html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi);

    // High-priority subpaths for business knowledge
    const priorityKeywords = ['faq', 'about', 'services', 'pricing', 'contact', 'product', 'terms', 'privacy', 'policy', 'help', 'features'];

    const candidates: Array<{ url: string; score: number }> = [];

    for (const match of linkMatches) {
      const rawHref = match[1]?.trim();
      if (!rawHref) continue;
      if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, baseUrl);
        // Only same hostname
        if (resolved.hostname.toLowerCase() !== baseObj.hostname.toLowerCase()) {
          continue;
        }

        // Avoid common file downloads & non-html assets
        const pathname = resolved.pathname.toLowerCase();
        if (pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|tar|exe|dmg|mp4|mp3|css|js|json)$/i)) {
          continue;
        }

        // Avoid auth, cart, logout, admin URLs
        if (pathname.match(/\/(cart|checkout|login|signup|logout|admin|account|wp-admin|dashboard)\b/i)) {
          continue;
        }

        // Exclude the base URL itself
        resolved.hash = '';
        resolved.search = '';
        const cleanUrl = resolved.toString();
        if (cleanUrl === baseUrl || cleanUrl === baseUrl + '/' || linksFound.has(cleanUrl)) {
          continue;
        }

        linksFound.add(cleanUrl);

        // Score link based on usefulness for AI context
        let score = 1;
        for (const kw of priorityKeywords) {
          if (pathname.includes(kw)) {
            score += 5;
          }
        }

        candidates.push({ url: cleanUrl, score });
      } catch {
        // Skip invalid URL
      }
    }

    // Sort by priority score and take top N
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxLinks).map(c => c.url);
  } catch {
    return [];
  }
}

export interface FetchHtmlResult {
  html: string;
  isMarkdown?: boolean;
  title?: string;
  finalUrl: string;
}

/**
 * Multi-tiered resilient fetcher with automatic 403 / Cloudflare / WAF anti-bot bypass.
 * 1. Modern Chrome Browser Headers with Sec-Ch-Ua
 * 2. Search Engine Crawler Persona (Googlebot)
 * 3. Search Engine Crawler Persona (Bingbot)
 * 4. Jina Reader AI Proxy (r.jina.ai)
 * 5. AllOrigins Proxy Fallback
 */
export async function fetchHtmlWithFallbacks(
  targetUrl: string,
  timeoutMs: number = 15000
): Promise<FetchHtmlResult> {
  const normalized = normalizeUrl(targetUrl);

  const attemptConfigs: Array<{
    name: string;
    url: string;
    headers: Record<string, string>;
    isJina?: boolean;
    isProxy?: boolean;
  }> = [
    // 1. Full Desktop Chrome Browser Persona
    {
      name: 'Chrome Browser',
      url: normalized,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    },
    // 2. Googlebot Crawler Persona (Bypasses many Cloudflare & firewall rules)
    {
      name: 'Googlebot Crawler',
      url: normalized,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
    // 3. Bingbot Crawler Persona
    {
      name: 'Bingbot Crawler',
      url: normalized,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
    // 4. Jina Reader AI (Built for LLM web reading, bypasses Cloudflare/JS SPAs)
    {
      name: 'Jina AI Reader',
      url: `https://r.jina.ai/${normalized}`,
      headers: {
        'Accept': 'text/plain, text/markdown, text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; WatiBotScraper/1.0)',
      },
      isJina: true,
    },
    // 5. AllOrigins CORS Proxy
    {
      name: 'AllOrigins Proxy',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      isProxy: true,
    },
  ];

  let lastError: Error | null = null;

  for (const config of attemptConfigs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));

    try {
      const res = await fetch(config.url, {
        method: 'GET',
        headers: config.headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length >= 30) {
          if (config.isJina) {
            return {
              html: text,
              isMarkdown: true,
              finalUrl: normalized,
            };
          }
          return {
            html: text,
            isMarkdown: false,
            finalUrl: normalized,
          };
        }
      } else {
        lastError = new Error(`HTTP Error ${res.status}: ${res.statusText} via ${config.name}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  throw lastError || new Error(`Failed to fetch content from ${normalized} after multiple attempts.`);
}

/**
 * Fetches and parses a single webpage
 */
export async function scrapeSinglePage(targetUrl: string, timeoutMs: number = 15000): Promise<ScrapedPageResult> {
  const normalized = normalizeUrl(targetUrl);
  const fetched = await fetchHtmlWithFallbacks(normalized, timeoutMs);

  if (fetched.isMarkdown) {
    let rawText = fetched.html.trim();
    let title = '';
    let description = '';

    const titleMatch = rawText.match(/^#\s+(.+)$/m) || rawText.match(/^Title:\s*(.+)$/im);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }
    if (!title) {
      try {
        const u = new URL(normalized);
        title = u.hostname + (u.pathname !== '/' ? u.pathname : '');
      } catch {
        title = normalized;
      }
    }

    const header = `Source URL: ${normalized}\nPage Title: ${title}`;
    const fullContent = rawText.startsWith('Source URL:') ? rawText : `${header}\n\n${rawText}`;

    return {
      url: normalized,
      title: title || normalized,
      description,
      content: fullContent,
      charCount: fullContent.length,
    };
  }

  const { title, description, content } = cleanHtmlToMarkdown(fetched.html, normalized);

  if (!content || content.trim().length < 50) {
    throw new Error(`Page content is too short or empty (less than 50 characters). It may be protected by JavaScript rendering.`);
  }

  return {
    url: normalized,
    title: title || normalized,
    description,
    content,
    charCount: content.length,
  };
}

/**
 * Crawls a website: Scrapes the starting URL, then optionally crawls high-value internal links
 */
export async function crawlWebsite(
  startUrl: string,
  options: {
    crawlMode?: 'single' | 'deep';
    maxPages?: number;
    timeoutPerUrl?: number;
  } = {}
): Promise<ScrapedPageResult[]> {
  const { crawlMode = 'single', maxPages = 5, timeoutPerUrl = 15000 } = options;
  const normalized = normalizeUrl(startUrl);

  // 1. Scrape the root/start page
  const rootResult = await scrapeSinglePage(normalized, timeoutPerUrl);
  const results: ScrapedPageResult[] = [rootResult];

  if (crawlMode === 'single' || maxPages <= 1) {
    return results;
  }

  // 2. Extract internal links from root page
  try {
    const routes = await discoverWebsiteRoutes(normalized, maxPages, timeoutPerUrl);
    const subRoutes = routes.filter(r => !r.isRoot && r.url !== normalized);

    for (const route of subRoutes) {
      if (results.length >= maxPages) break;
      try {
        const subResult = await scrapeSinglePage(route.url, timeoutPerUrl);
        if (subResult.charCount >= 80) {
          results.push(subResult);
        }
      } catch (subErr: any) {
        console.warn(`[WebScraper] Failed to scrape internal link ${route.url}:`, subErr.message);
      }
    }
  } catch (crawlErr: any) {
    console.warn(`[WebScraper] Link discovery failed for ${normalized}:`, crawlErr.message);
  }

  return results;
}

export interface DiscoveredRoute {
  url: string;
  path: string;
  title: string;
  isRoot?: boolean;
}

/**
 * Discovers available internal routes/pages from a website's starting URL.
 * Extracts page URLs, clean paths, and descriptive titles from navigation/links.
 */
export async function discoverWebsiteRoutes(
  targetUrl: string,
  maxRoutes: number = 30,
  timeoutMs: number = 15000
): Promise<DiscoveredRoute[]> {
  const normalized = normalizeUrl(targetUrl);
  const baseObj = new URL(normalized);

  const routes: DiscoveredRoute[] = [];
  const seenUrls = new Set<string>();

  try {
    const fetched = await fetchHtmlWithFallbacks(normalized, timeoutMs);
    const html = fetched.html;

    // 1. Extract Root Page Title
    let rootTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      rootTitle = decodeHtmlEntities(titleMatch[1].trim());
    }
    if (!rootTitle) {
      rootTitle = baseObj.hostname;
    }

    // Clean brand suffixes like " | Company Name"
    const cleanedRootTitle = rootTitle.split(/\s*[-|•–—]\s*/)[0].trim() || rootTitle;

    // Add Root Page as first entry
    routes.push({
      url: normalized,
      path: baseObj.pathname || '/',
      title: cleanedRootTitle || 'Home',
      isRoot: true,
    });
    seenUrls.add(normalized);
    seenUrls.add(normalized.replace(/\/$/, ''));
    seenUrls.add(normalized + '/');

    // 2. Discover all anchor links with their text
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    const candidateMap = new Map<string, { url: string; path: string; title: string; score: number }>();

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1]?.trim();
      const rawAnchor = match[2]?.trim() || '';

      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, normalized);

        // Enforce same hostname
        if (resolved.hostname.toLowerCase() !== baseObj.hostname.toLowerCase()) {
          continue;
        }

        const pathname = resolved.pathname.toLowerCase();

        // Skip static file assets & media
        if (pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|tar|exe|dmg|mp4|mp3|css|js|json|xml|ico|woff|woff2|ttf)$/i)) {
          continue;
        }

        // Skip auth/admin/account/cart routes
        if (pathname.match(/\/(cart|checkout|login|signin|signup|register|logout|admin|wp-admin|dashboard|account|session|auth)\b/i)) {
          continue;
        }

        // Clean tracking/hash
        resolved.hash = '';
        resolved.search = '';
        const cleanUrl = resolved.toString();
        const normalizedClean = cleanUrl.replace(/\/$/, '');

        if (seenUrls.has(cleanUrl) || seenUrls.has(normalizedClean)) {
          continue;
        }

        // Clean anchor title
        let titleCandidate = stripAllTags(rawAnchor).trim();
        titleCandidate = decodeHtmlEntities(titleCandidate).replace(/\s+/g, ' ');

        // If anchor text was empty or too long/short, derive a readable title from pathname slug
        if (!titleCandidate || titleCandidate.length < 2 || titleCandidate.length > 80) {
          const segments = resolved.pathname.split('/').filter(Boolean);
          if (segments.length > 0) {
            const lastSegment = segments[segments.length - 1]
              .replace(/[-_]+/g, ' ')
              .replace(/\.[^/.]+$/, '');
            titleCandidate = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
          } else {
            titleCandidate = 'Page';
          }
        }

        // Clean any residual punctuation
        titleCandidate = titleCandidate.replace(/^[-|•–—\s]+|[-|•–—\s]+$/g, '');

        let score = 1;
        const lowerPath = resolved.pathname.toLowerCase();
        if (lowerPath.includes('product') || lowerPath.includes('pricing') || lowerPath.includes('service') || lowerPath.includes('faq')) {
          score += 10;
        } else if (lowerPath.includes('about') || lowerPath.includes('contact') || lowerPath.includes('feature') || lowerPath.includes('menu')) {
          score += 5;
        }

        if (!candidateMap.has(normalizedClean)) {
          candidateMap.set(normalizedClean, {
            url: cleanUrl,
            path: resolved.pathname || '/',
            title: titleCandidate || resolved.pathname,
            score,
          });
        }
      } catch {
        // Skip invalid url
      }
    }

    // 3. Extract routes from JSON-LD ItemList & schema URLs
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const jm of jsonLdMatches) {
      try {
        const raw = JSON.parse(jm[1]);
        const items = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw];
        for (const item of items) {
          if (!item) continue;
          const list = item.itemListElement || item.hasMenuItem || [];
          if (Array.isArray(list)) {
            for (const el of list) {
              const uStr = el.url || el.item?.url;
              const name = el.name || el.item?.name;
              if (uStr && typeof uStr === 'string' && name && typeof name === 'string') {
                try {
                  const resolved = new URL(uStr, normalized);
                  if (resolved.hostname.toLowerCase() === baseObj.hostname.toLowerCase()) {
                    resolved.hash = '';
                    const cleanUrl = resolved.toString();
                    const normalizedClean = cleanUrl.replace(/\/$/, '');
                    if (!seenUrls.has(cleanUrl) && !seenUrls.has(normalizedClean)) {
                      candidateMap.set(normalizedClean, {
                        url: cleanUrl,
                        path: resolved.pathname || '/',
                        title: name.trim(),
                        score: 8,
                      });
                    }
                  }
                } catch {
                  // Ignore
                }
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    // 4. If few routes were found (e.g. Single Page Apps / React SPAs), try probing /sitemap.xml
    if (candidateMap.size < 3) {
      try {
        const sitemapUrl = `${baseObj.origin}/sitemap.xml`;
        const sitemapRes = await fetch(sitemapUrl, {
          headers: DEFAULT_HEADERS,
          signal: AbortSignal.timeout(4000),
        });
        if (sitemapRes.ok) {
          const sitemapXml = await sitemapRes.text();
          const locMatches = sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi);
          for (const lm of locMatches) {
            const locUrl = lm[1]?.trim();
            if (!locUrl) continue;
            try {
              const u = new URL(locUrl);
              if (u.origin.toLowerCase() === baseObj.origin.toLowerCase()) {
                u.hash = '';
                const cleanUrl = u.toString();
                const normalizedClean = cleanUrl.replace(/\/$/, '');
                if (!seenUrls.has(cleanUrl) && !seenUrls.has(normalizedClean)) {
                  const segs = u.pathname.split('/').filter(Boolean);
                  let titleCandidate = '';
                  if (segs.length > 0) {
                    const last = segs[segs.length - 1].replace(/[-_]+/g, ' ');
                    titleCandidate = last.charAt(0).toUpperCase() + last.slice(1);
                  } else {
                    titleCandidate = 'Home';
                  }

                  let score = 2;
                  const lower = u.pathname.toLowerCase();
                  if (lower.includes('product') || lower.includes('menu') || lower.includes('item')) score += 5;
                  if (lower.includes('faq') || lower.includes('about') || lower.includes('contact')) score += 3;

                  candidateMap.set(normalizedClean, {
                    url: cleanUrl,
                    path: u.pathname || '/',
                    title: titleCandidate,
                    score,
                  });
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore sitemap fetch errors
      }
    }

    // Sort by priority and append to routes
    const sortedCandidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
    for (const c of sortedCandidates) {
      if (routes.length >= maxRoutes) break;
      routes.push({
        url: c.url,
        path: c.path,
        title: c.title,
        isRoot: false,
      });
      seenUrls.add(c.url);
      seenUrls.add(c.url.replace(/\/$/, ''));
    }

    return routes;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Website scanning timed out after ${timeoutMs / 1000}s. Please check if the URL is accessible.`);
    }
    throw err;
  }
}


