import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import FormData from "form-data";

import {
  DEFAULT_UA,
  resolveUrl,
  normalizeDetailsUrl,
  withRetry,
  sleep,
  parseCookieInput,
} from "./utils.js";

import {
  parseTestPage,
  parseDetailsPage,
  mergeDetailsIntoSections,
  canParseAsTestPage,
  extractStartUrlFromLanding,
  looksLikeLoginPage,
  detectSkillFromPage,
} from "./parsers.js";

import { buildAssignment } from "./builders.js";

// ── HTTP client ─────────────────────────────────────────────────────────────

export function createAxios() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) =>
        (status >= 200 && status < 400) || status === 302,
      timeout: 60000,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }),
  );
  return { client, jar };
}

export async function seedCookieJar(jar, baseUrl, cookieInput) {
  if (!cookieInput) return 0;
  const origin = new URL(baseUrl).origin;
  const items = parseCookieInput(cookieInput, origin);
  for (const item of items) {
    await jar.setCookie(item.cookie, item.url);
  }
  return items.length;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RANDOM_WORDS = ["test", "answer", "A", "B", "C", "sample", "placeholder"];

function randomAnswer() {
  const w = RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
  return `${w}${Math.floor(Math.random() * 999)}`;
}

function testIdFromUrl(testUrl) {
  const m = new URL(testUrl).pathname.match(/\/tests\/(\d+)\//);
  if (!m) throw new Error(`Cannot extract test id from: ${testUrl}`);
  return m[1];
}

function finishUrl(testUrl) {
  const u = new URL(testUrl);
  const id = testIdFromUrl(testUrl);
  return `${u.origin}/tests/${id}/finish/`;
}

function locationHeader(res) {
  return res.headers.location ?? res.headers.Location ?? res.headers["location"] ?? null;
}

function isRedirectStatus(status) {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

function inferUid(hidden, html) {
  const candidates = [hidden.uid, hidden.user_id, hidden.userid, hidden.userId]
    .filter((v) => v != null && String(v).trim().length > 0);
  if (candidates.length) return String(candidates[0]);
  const m = String(html).match(/window\.current_user[\s\S]*?\bid\s*:\s*(\d+)/i);
  return m?.[1] ?? "";
}

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ── Core scrape flow ────────────────────────────────────────────────────────

/**
 * Scrape a single Study4 test.
 * @param {string} testPageUrl - Landing or info page URL
 * @param {{
 *   skill?: string | null;
 *   delayMs?: number;
 *   retries?: number;
 *   cookieInput?: string | null;
 *   createdBy?: string;
 *   classId?: string | null;
 *   isPublic?: boolean;
 *   slug?: string | null;
 *   title?: string | null;
 *   description?: string | null;
 * }} options
 */
export async function scrapeTest(testPageUrl, options = {}) {
  const {
    skill: skillHint = null,
    delayMs = 400,
    retries = 3,
    cookieInput = null,
    createdBy = "study4-scraper",
    classId = null,
    isPublic = false,
    slug = null,
    title = null,
    description = null,
  } = options;

  const { client, jar } = createAxios();
  await seedCookieJar(jar, testPageUrl, cookieInput);

  /**
   * GET with manual redirect following (axios is maxRedirects:0 for POST /finish handling).
   * Sets res.finalUrl to the last URL after redirects.
   */
  async function getPage(url, referer) {
    let current = url;
    let ref = referer;
    const maxHops = 12;
    for (let hop = 0; hop < maxHops; hop++) {
      const res = await withRetry(
        () =>
          client.get(current, { headers: ref ? { Referer: ref } : {} }),
        { retries, delayMs },
      );

      if (res.status === 200) {
        res.finalUrl = current;
        return res;
      }

      if (isRedirectStatus(res.status)) {
        const loc = locationHeader(res);
        if (!loc) {
          throw new Error(`HTTP ${res.status} from ${current} but no Location header`);
        }
        const next = resolveUrl(current, loc);
        if (!next) throw new Error(`Bad redirect Location from ${current}: ${loc}`);
        if (/\/login\b/i.test(next) || /\/oauth\//i.test(next)) {
          throw new Error(
            `Study4 redirected to login (${next}). Opening /start/ requires a signed-in session: ` +
              `export cookies from your browser after logging in (include session cookies like sessionid; csrftoken alone is not enough).`,
          );
        }
        ref = current;
        current = next;
        await sleep(delayMs);
        continue;
      }

      throw new Error(`HTTP ${res.status} for ${current}`);
    }
    throw new Error(`Too many redirects (>${maxHops}) for ${url}`);
  }

  // Step 1: Load landing page
  const landingRes = await getPage(testPageUrl);
  if (landingRes.status !== 200) {
    throw new Error(`Test page HTTP ${landingRes.status}`);
  }
  if (looksLikeLoginPage(landingRes.data)) {
    throw new Error(
      "Study4 returned a login page. Provide an authenticated cookie via --cookie/--cookie-file or STUDY4_COOKIE.",
    );
  }

  // Detect skill from landing page if not provided
  const detectedSkill = skillHint ?? detectSkillFromPage(landingRes.data);
  const skill = detectedSkill ?? "listening";

  // Step 2: Navigate to /start/ if needed
  let activePageUrl = landingRes.finalUrl || testPageUrl;
  let activePageHtml = landingRes.data;
  if (!canParseAsTestPage(activePageHtml)) {
    const startUrl = extractStartUrlFromLanding(activePageHtml, testPageUrl);
    if (!startUrl) {
      throw new Error("Could not find /start/ URL from the test page.");
    }
    await sleep(delayMs);
    const startRes = await getPage(startUrl, testPageUrl);
    if (looksLikeLoginPage(startRes.data)) {
      throw new Error(
        "Study4 start page requires login. Provide an authenticated cookie.",
      );
    }
    activePageUrl = startRes.finalUrl || startUrl;
    activePageHtml = startRes.data;
  }

  // Step 3: Parse test page into sections
  const parsed = parseTestPage(activePageHtml, activePageUrl, skill);

  // Step 4: Submit with random answers
  const allQids = parsed.allQuestionIds;
  if (!allQids.length && (skill === "listening" || skill === "reading")) {
    if (looksLikeLoginPage(activePageHtml)) {
      throw new Error(
        "Session expired — /start/ returned a login page. Re-export cookies from your browser.",
      );
    }
    const snippet = String(activePageHtml).slice(0, 500).replace(/\s+/g, " ");
    throw new Error(
      `No question IDs found on the test page (session may have expired). URL: ${activePageUrl} — HTML preview: ${snippet}`,
    );
  }

  const fin = finishUrl(testPageUrl);
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + 30 + Math.floor(Math.random() * 120);

  const postFields = {
    ...parsed.hidden,
    csrfmiddlewaretoken: parsed.csrf,
    start_time: String(startTime),
    end_time: String(endTime),
    time_limit: "40",
    timeleft_value: "0",
  };
  const uid = inferUid(parsed.hidden, activePageHtml);
  if (uid) postFields.uid = String(uid);

  for (const qid of allQids) {
    postFields[`question-${qid}`] = randomAnswer();
    if (skill === "speaking") {
      postFields[`audio-question-${qid}`] = "";
    }
  }

  await sleep(delayMs);

  const form = new FormData();
  for (const [k, v] of Object.entries(postFields)) {
    form.append(k, String(v));
  }

  const finishRes = await withRetry(
    () =>
      client.post(fin, form, {
        headers: {
          ...form.getHeaders(),
          Referer: activePageUrl,
          Origin: new URL(activePageUrl).origin,
        },
      }),
    { retries, delayMs },
  );

  if (finishRes.status !== 302) {
    const snippet = String(finishRes.data ?? "").slice(0, 300);
    throw new Error(
      `Expected 302 from finish, got ${finishRes.status}. Body: ${snippet}`,
    );
  }

  const loc = locationHeader(finishRes);
  if (!loc) throw new Error("302 from finish but no Location header");
  const resultsUrl = resolveUrl(fin, loc);
  if (!resultsUrl) throw new Error(`Bad Location: ${loc}`);

  // Step 5: GET results page (required to establish session)
  await sleep(delayMs);
  const resultsRes = await getPage(resultsUrl, activePageUrl);
  if (resultsRes.status !== 200) {
    throw new Error(`Results page HTTP ${resultsRes.status}`);
  }

  // Step 6: GET details page
  const detailsUrl = normalizeDetailsUrl(resultsUrl);
  await sleep(delayMs);
  const detailsRes = await getPage(detailsUrl, resultsUrl);
  if (detailsRes.status !== 200) {
    throw new Error(`Details page HTTP ${detailsRes.status}`);
  }

  // Step 7: Parse details and merge correct answers into sections
  const details = parseDetailsPage(detailsRes.data);
  mergeDetailsIntoSections(parsed.sections, details.detailRows);

  // Step 8: Build schema-correct assignment document
  const finalTitle = title ?? parsed.title ?? `Study4 ${skill} Assignment`;
  const finalSlug =
    slug ?? (slugify(finalTitle) || `study4-${skill}-${Date.now()}`);

  const meta = {
    title: finalTitle,
    description,
    slug: finalSlug,
    createdBy,
    classId,
    isPublic,
  };

  const assignment = buildAssignment(
    skill,
    meta,
    parsed.sections,
    details.sectionTranscripts,
  );

  return {
    sourceUrl: testPageUrl,
    skill,
    resultsUrl,
    detailsUrl,
    assignment,
  };
}
