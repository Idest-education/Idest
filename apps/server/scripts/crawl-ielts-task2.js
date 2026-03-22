/* eslint-disable no-console */
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const API_URL =
  "https://apigateway.dolenglish.vn/public/search-transform/api/filter/samples";
const SITE_ORIGIN = "https://tuhoc.dolenglish.vn";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Origin: SITE_ORIGIN,
  Referer: `${SITE_ORIGIN}/`,
};

const API_DELAY_MIN_MS = 200;
const API_DELAY_MAX_MS = 500;
const BLOG_DELAY_MIN_MS = 200;
const BLOG_DELAY_MAX_MS = 500;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(minMs, maxMs) {
  await sleep(randomInt(minMs, maxMs));
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await withTimeout(
        fetch(url, options),
        REQUEST_TIMEOUT_MS,
        label,
      );
      if (!response.ok) {
        throw new Error(`${label} failed: HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8_000);
      console.warn(
        `[retry ${attempt}/${MAX_RETRIES}] ${label}: ${error.message}. Sleeping ${backoffMs}ms`,
      );
      await sleep(backoffMs);
    }
  }
  throw lastError;
}

function buildPayload(page) {
  return {
    query: "",
    filters: {
      all: [
        { content_group: "WRITING" },
        { type: "WRITING_TASK_2_ACADEMIC" },
      ],
    },
    facets: {
      topic: [{ type: "value" }],
      year: [{ type: "value" }],
      question_type: [{ type: "value" }],
    },
    page: { current: page, size: 9 },
    sort: [{ year_quarter: "desc" }, { created_at: "desc" }],
  };
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("http")) return rawUrl;
  return `${SITE_ORIGIN}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

function getRaw(result, field) {
  return result?.[field]?.raw ?? null;
}

function normalizeWhitespace(input) {
  return (input || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanText(input) {
  return normalizeWhitespace(
    input
      .replace(/\r/g, "\n")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'"),
  );
}

function pickMainRoot($) {
  const preferred = [
    "article",
    "main",
    "[class*='article']",
    "[class*='post']",
    "[class*='content']",
    "[class*='entry']",
  ];
  for (const selector of preferred) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $("body");
}

function extractFromDom(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe").remove();

  const root = pickMainRoot($);
  const parts = [];
  root.find("h1, h2, h3, h4, p, li, blockquote").each((_, el) => {
    const line = cleanText($(el).text());
    if (line) parts.push(line);
  });

  let fullText = cleanText(parts.join("\n\n"));
  const startMarkers = ["🚀 Đề bài", "Task 2:", "📝 Bài mẫu"];
  for (const marker of startMarkers) {
    const idx = fullText.indexOf(marker);
    if (idx > 0) {
      fullText = fullText.slice(idx);
      break;
    }
  }
  const endMarkers = ["Bài viết khác", "Related posts"];
  for (const marker of endMarkers) {
    const idx = fullText.indexOf(marker);
    if (idx > 0) {
      fullText = fullText.slice(0, idx);
      break;
    }
  }
  fullText = cleanText(fullText);
  const lines = fullText.split("\n").map((x) => x.trim()).filter(Boolean);

  const questionCandidates = lines.filter((line) =>
    /(task\s*2|question|đề bài|de bai|write about|to what extent|discuss both views|advantages|disadvantages|agree or disagree)/i.test(
      line,
    ),
  );

  let question = questionCandidates.length
    ? questionCandidates.slice(0, 3).join("\n")
    : null;

  const questionMarker = "🚀 Đề bài";
  const qStart = fullText.lastIndexOf(questionMarker);
  if (qStart >= 0) {
    const qSlice = fullText.slice(qStart + questionMarker.length);
    const qEndMatch = qSlice.match(/(?:😵|📝|📚|✨|💡)/);
    const qBlock = qEndMatch ? qSlice.slice(0, qEndMatch.index) : qSlice;
    const candidate = cleanText(qBlock);
    if (candidate) question = candidate;
  }

  let essay = fullText;
  const essayMarker = "📝 Bài mẫu";
  const eStart = fullText.lastIndexOf(essayMarker);
  if (eStart >= 0) {
    const eSlice = fullText.slice(eStart + essayMarker.length);
    const eEndMatch = eSlice.match(/(?:📚|✨|💡)/);
    const eBlock = eEndMatch ? eSlice.slice(0, eEndMatch.index) : eSlice;
    const candidate = cleanText(eBlock);
    if (candidate) essay = candidate;
  }
  essay = essay.replace(/^Dàn ý\s*/i, "").trim();

  return { essay: essay || null, question };
}

function isEssayLikelyValid(essay) {
  if (!essay) return false;
  const words = essay.split(/\s+/).filter(Boolean).length;
  return words >= 120;
}

async function fetchMetadataPage(page) {
  const response = await fetchWithRetry(
    API_URL,
    {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(buildPayload(page)),
    },
    `API page ${page}`,
  );
  return response.json();
}

async function fetchAllMetadata(maxPages) {
  const first = await fetchMetadataPage(1);
  const totalPages = first?.meta?.page?.total_pages ?? 1;
  const pagesToFetch =
    Number.isInteger(maxPages) && maxPages > 0
      ? Math.min(maxPages, totalPages)
      : totalPages;

  const allResults = [...(first.results || [])];
  console.log(
    `Fetched page 1/${pagesToFetch}. Results so far: ${allResults.length}`,
  );

  for (let page = 2; page <= pagesToFetch; page += 1) {
    await randomDelay(API_DELAY_MIN_MS, API_DELAY_MAX_MS);
    const data = await fetchMetadataPage(page);
    allResults.push(...(data.results || []));
    console.log(`Fetched page ${page}/${pagesToFetch}. Total: ${allResults.length}`);
  }

  return allResults.map((item) => ({
    id: getRaw(item, "id"),
    title: getRaw(item, "title"),
    url: normalizeUrl(getRaw(item, "url")),
    topic: getRaw(item, "topic"),
    type: getRaw(item, "type"),
  }));
}

async function scrapeWithCheerio(url) {
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 IELTSDatasetCrawler/1.0" },
    },
    `Blog page ${url}`,
  );
  const html = await response.text();
  return extractFromDom(html);
}

async function scrapeWithPlaywright(url, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    const html = await page.content();
    return extractFromDom(html);
  } finally {
    await page.close();
  }
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }).map(
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function crawlBlogs(metadataRows, concurrency) {
  const output = new Array(metadataRows.length);
  let browser = null;

  await runWithConcurrency(
    metadataRows.map((row, idx) => ({ row, idx })),
    concurrency,
    async ({ row, idx }) => {
      await randomDelay(BLOG_DELAY_MIN_MS, BLOG_DELAY_MAX_MS);
      if (!row.url) {
        output[idx] = { ...row, question: null, essay: null };
        return;
      }

      let parsed = null;
      try {
        parsed = await scrapeWithCheerio(row.url);
      } catch (error) {
        console.warn(`Cheerio fetch failed for ${row.url}: ${error.message}`);
      }

      if (!isEssayLikelyValid(parsed?.essay)) {
        try {
          if (!browser) browser = await chromium.launch({ headless: true });
          parsed = await scrapeWithPlaywright(row.url, browser);
        } catch (error) {
          console.warn(`Playwright fallback failed for ${row.url}: ${error.message}`);
        }
      }

      output[idx] = {
        title: row.title,
        url: row.url,
        topic: row.topic,
        type: row.type,
        id: row.id,
        question: parsed?.question || null,
        essay: parsed?.essay || null,
      };

      console.log(`[${idx + 1}/${metadataRows.length}] Scraped ${row.url}`);
    },
  );

  if (browser) await browser.close();
  return output;
}

function parseArgs(argv) {
  const args = {
    output: path.resolve(process.cwd(), "data/ielts_task2_dataset.json"),
    concurrency: 3,
    maxPages: null,
    maxItems: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--output" && value) {
      args.output = path.resolve(process.cwd(), value);
      i += 1;
    } else if (key === "--concurrency" && value) {
      const n = Number.parseInt(value, 10);
      if (Number.isInteger(n) && n > 0) args.concurrency = n;
      i += 1;
    } else if (key === "--max-pages" && value) {
      const n = Number.parseInt(value, 10);
      if (Number.isInteger(n) && n > 0) args.maxPages = n;
      i += 1;
    } else if (key === "--max-items" && value) {
      const n = Number.parseInt(value, 10);
      if (Number.isInteger(n) && n > 0) args.maxItems = n;
      i += 1;
    }
  }

  return args;
}

async function main() {
  const { output, concurrency, maxPages, maxItems } = parseArgs(
    process.argv.slice(2),
  );
  console.log("Starting IELTS Task 2 crawler...");
  console.log(`Output file: ${output}`);
  console.log(`Concurrency: ${concurrency}`);

  let metadata = await fetchAllMetadata(maxPages);
  if (maxItems) {
    metadata = metadata.slice(0, maxItems);
    console.log(`Applied --max-items ${maxItems}. Rows kept: ${metadata.length}`);
  }
  console.log(`Collected metadata rows: ${metadata.length}`);

  const crawled = await crawlBlogs(metadata, concurrency);
  const cleanRows = crawled.map((row) => ({
    title: row.title,
    url: row.url,
    topic: row.topic,
    type: row.type,
    id: row.id,
    question: cleanText(row.question || ""),
    essay: cleanText(row.essay || ""),
  }));

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(cleanRows, null, 2), "utf8");

  const withEssay = cleanRows.filter((r) => r.essay).length;
  console.log(`Done. Saved ${cleanRows.length} rows to ${output}`);
  console.log(`Rows with non-empty essay text: ${withEssay}/${cleanRows.length}`);
}

main().catch((error) => {
  console.error("Crawler failed:", error);
  process.exitCode = 1;
});
