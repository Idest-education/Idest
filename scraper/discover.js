import * as cheerio from "cheerio";
import { resolveUrl, withRetry, sleep } from "./utils.js";

const BASE_URL = "https://study4.com/tests/";
const SKILL_KEYWORDS = ["listening", "reading", "writing", "speaking"];

function detectSkill(tagTexts) {
  const joined = tagTexts.join(" ").toLowerCase();
  for (const skill of SKILL_KEYWORDS) {
    if (joined.includes(skill)) return skill;
  }
  return null;
}

function parseListingPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const tests = [];

  // Study4 listing (2025+): .testitem-wrapper / .testitem-grid; older/alternate layouts below.
  $(
    ".testitem-wrapper, .test-item, .exam-item, [class*='test-card'], .contentblock a[href*='/tests/']",
  ).each((_, el) => {
    const $el = $(el);
    const $link = $el.is("a") ? $el : $el.find("a[href*='/tests/']").first();
    const href = $link.attr("href");
    if (!href || !/\/tests\/\d+\//.test(href)) return;

    const url = resolveUrl(pageUrl, href);
    if (!url) return;

    const title =
      $el.find("h2.testitem-title, h3.testitem-title, .testitem-title").first().text().replace(/\s+/g, " ").trim() ||
      $link.text().replace(/\s+/g, " ").trim() ||
      $el.find("h2, h3, h4, .test-title").first().text().replace(/\s+/g, " ").trim();

    const tags = [];
    $el.find(".tag, .badge, [class*='tag']").each((_, t) => {
      tags.push($(t).text().trim());
    });
    if (!tags.length) {
      const $parent = $el.closest(".contentblock, .card, .item, .row");
      if ($parent.length) {
        $parent.find(".tag, .badge").each((_, t) => {
          tags.push($(t).text().trim());
        });
      }
    }

    const skill = detectSkill(tags) || detectSkill([title]);
    if (url && title) {
      tests.push({ url, title, skill, tags });
    }
  });

  // Deduplicate by URL
  const seen = new Set();
  return tests.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}

function findNextPageUrl(html, currentUrl) {
  const $ = cheerio.load(html);
  const cur = new URL(currentUrl);
  const pageParam = cur.searchParams.get("page");
  const currentPageNum =
    pageParam && /^\d+$/.test(pageParam) ? parseInt(pageParam, 10) : 1;
  const wantNext = currentPageNum + 1;

  let $relNext = $('a[rel="next"]').first();
  if ($relNext.length) {
    const href = $relNext.attr("href");
    if (href) return resolveUrl(currentUrl, href);
  }

  // Study4: <div class='pagination'> with <a class='page-link' href="?page=2">
  let fromPagination = null;
  $(".pagination a.page-link").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, currentUrl);
      const p = u.searchParams.get("page");
      if (p && parseInt(p, 10) === wantNext) {
        fromPagination = resolveUrl(currentUrl, href);
        return false;
      }
    } catch {
      /* ignore */
    }
  });
  if (fromPagination && fromPagination !== currentUrl) return fromPagination;

  const $chev = $(".pagination a.page-link i.fa-chevron-right").closest("a.page-link");
  if ($chev.length) {
    const href = $chev.attr("href");
    if (href) {
      const resolved = resolveUrl(currentUrl, href);
      if (resolved && resolved !== currentUrl) return resolved;
    }
  }

  const hasCards =
    $(".testitem-wrapper, .test-item, .exam-item, [class*='test-card']").length > 0;
  if (hasCards) {
    cur.searchParams.set("page", String(wantNext));
    return cur.href;
  }
  return null;
}

/**
 * Crawl study4.com/tests/ listing pages.
 * @param {Function} getPage - async (url, referer?) => { data }
 * @param {{ maxPages?: number; skillFilter?: string[]; delayMs?: number }} options
 * @returns {Promise<Array<{ url: string; title: string; skill: string | null; tags: string[] }>>}
 */
export async function discoverTests(getPage, options = {}) {
  const { maxPages = 50, skillFilter = null, delayMs = 400 } = options;
  const allTests = [];
  let currentUrl = BASE_URL;
  let emptyStreak = 0;

  for (let page = 1; page <= maxPages; page++) {
    console.error(`[discover] Fetching page ${page}: ${currentUrl}`);
    const res = await getPage(currentUrl);
    if (res.status !== 200) {
      console.error(`[discover] Page ${page} returned HTTP ${res.status}, stopping.`);
      break;
    }

    const tests = parseListingPage(res.data, currentUrl);
    if (!tests.length) {
      emptyStreak++;
      if (emptyStreak >= 2) {
        console.error(`[discover] No tests found on ${emptyStreak} consecutive pages, stopping.`);
        break;
      }
    } else {
      emptyStreak = 0;
    }

    for (const t of tests) {
      if (skillFilter && t.skill && !skillFilter.includes(t.skill)) continue;
      allTests.push(t);
    }

    console.error(`[discover] Found ${tests.length} tests on page ${page} (total: ${allTests.length})`);

    const nextUrl = findNextPageUrl(res.data, currentUrl);
    if (!nextUrl || nextUrl === currentUrl) break;
    currentUrl = nextUrl;
    await sleep(delayMs);
  }

  // Deduplicate final list
  const seen = new Set();
  return allTests.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}
