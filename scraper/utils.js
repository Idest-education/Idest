/**
 * Small helpers: delays, URL resolution, retry wrapper.
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function resolveUrl(base, href) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/**
 * Append /details/ to the results URL (study4 redirect target).
 */
export function normalizeDetailsUrl(resultsUrl) {
  const u = new URL(resultsUrl);
  const base = u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname;
  u.pathname = `${base}/details/`;
  return u.href;
}

function jitter(ms) {
  return ms + Math.floor(Math.random() * Math.min(250, ms * 0.25));
}

/**
 * Retries when fn throws; retryable = network-ish errors or HTTP 5xx.
 */
export async function withRetry(fn, { retries = 3, delayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;
      const retryable =
        status === undefined ||
        status >= 500 ||
        e.code === "ECONNRESET" ||
        e.code === "ETIMEDOUT" ||
        e.code === "ECONNABORTED";
      if (!retryable || attempt === retries) throw e;
      await sleep(jitter(delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

function parseNetscapeCookieLine(line) {
  const cols = line.split("\t");
  if (cols.length < 7) return null;
  const [domain, _includeSubdomains, path, secureRaw, _expiry, name, value] = cols;
  if (!domain || !path || !name) return null;
  const host = domain.startsWith(".") ? domain.slice(1) : domain;
  const secure = String(secureRaw).toUpperCase() === "TRUE";
  const url = `${secure ? "https" : "http"}://${host}${path}`;
  const cookie = `${name}=${value ?? ""}; Domain=${domain}; Path=${path}${secure ? "; Secure" : ""}`;
  return { url, cookie };
}

function parseCookiePairs(raw, baseUrl) {
  const pairs = String(raw)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.includes("="));
  return pairs.map((pair) => ({
    url: baseUrl,
    cookie: pair,
  }));
}

/**
 * Parse cookie input from either Netscape cookie file format or
 * raw "k=v; k2=v2" cookie header format.
 */
export function parseCookieInput(cookieInput, baseUrl) {
  const raw = String(cookieInput ?? "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const hasNetscapeShape = lines.some(
    (line) =>
      line.includes("\t") &&
      !line.trim().startsWith("#") &&
      line.trim().length > 0,
  );
  if (hasNetscapeShape) {
    return lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(parseNetscapeCookieLine)
      .filter(Boolean);
  }
  return parseCookiePairs(raw, baseUrl);
}

import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Keep line breaks
turndown.addRule("br", {
  filter: "br",
  replacement: () => "  \n",
});

// Convert images to markdown with alt text
turndown.addRule("img", {
  filter: "img",
  replacement: (_, node) => {
    const src = node.getAttribute("src") ?? "";
    const alt = node.getAttribute("alt") ?? "";
    return `![${alt}](${src})`;
  },
});

// Skip Cloudflare email-protected spans
turndown.addRule("cfEmail", {
  filter: (node) =>
    node.nodeName === "A" && (node.classList?.contains("__cf_email__") || false),
  replacement: () => "[email]",
});

/**
 * Convert HTML string to markdown, preserving bold, italic, headings, images, line breaks.
 */
export function htmlToMarkdown(html) {
  if (!html) return "";
  const md = turndown.turndown(String(html));
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extract all image URLs (with optional width/height) from an HTML string.
 * Returns array of { url, width?, height?, alt? }.
 */
export function extractImagesFromHtml(html) {
  if (!html) return [];
  const images = [];
  const imgRegex = /<img[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const src = tag.match(/src=["']([^"']+)["']/)?.[1];
    if (!src) continue;
    const alt = tag.match(/alt=["']([^"']*?)["']/)?.[1] ?? "";
    const w = tag.match(/width[=:]\s*["']?(\d+)/)?.[1];
    const h = tag.match(/height[=:]\s*["']?(\d+)/)?.[1];
    images.push({
      url: src,
      ...(alt ? { alt } : {}),
      ...(w ? { width: parseInt(w, 10) } : {}),
      ...(h ? { height: parseInt(h, 10) } : {}),
    });
  }
  return images;
}

export function extractJsString(html, variableName) {
  const pattern = new RegExp(
    String.raw`${variableName}\s*=\s*['"]([^'"]+)['"]`,
    "i",
  );
  const m = String(html).match(pattern);
  return m ? m[1] : null;
}

export { DEFAULT_UA };
