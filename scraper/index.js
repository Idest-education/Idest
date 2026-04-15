#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { scrapeTest, createAxios, seedCookieJar } from "./scraper.js";
import { discoverTests } from "./discover.js";
import { withRetry, sleep } from "./utils.js";

function parseArgs(argv) {
  const opts = {
    url: null,
    outFile: null,
    outDir: null,
    discover: false,
    skill: null,
    maxPages: 50,
    delayMs: 400,
    retries: 3,
    cookie: process.env.STUDY4_COOKIE ?? null,
    cookieFile: null,
    createdBy: process.env.STUDY4_CREATED_BY ?? "study4-scraper",
    classId: process.env.STUDY4_CLASS_ID ?? null,
    slug: process.env.STUDY4_SLUG ?? null,
    title: process.env.STUDY4_TITLE ?? null,
    description: process.env.STUDY4_DESCRIPTION ?? null,
    isPublic: process.env.STUDY4_IS_PUBLIC === "true",
    populateApi: false,
    apiBaseUrl: process.env.ASSIGNMENTS_API_URL ?? null,
    apiToken: process.env.ASSIGNMENTS_API_TOKEN ?? null,
    batchDelayMs: 3000,
    maxConsecutiveFails: 5,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--discover") {
      opts.discover = true;
    } else if (a === "--out") {
      opts.outFile = argv[++i];
      if (!opts.outFile) throw new Error("--out requires a path");
    } else if (a === "--out-dir") {
      opts.outDir = argv[++i];
      if (!opts.outDir) throw new Error("--out-dir requires a path");
    } else if (a === "--skill") {
      opts.skill = argv[++i];
      if (!opts.skill) throw new Error("--skill requires a value (e.g. listening,reading)");
    } else if (a === "--max-pages") {
      opts.maxPages = parseInt(argv[++i], 10);
      if (!Number.isFinite(opts.maxPages) || opts.maxPages < 1) {
        throw new Error("--max-pages must be a positive number");
      }
    } else if (a === "--cookie") {
      opts.cookie = argv[++i];
      if (!opts.cookie) throw new Error("--cookie requires a value");
    } else if (a === "--cookie-file") {
      opts.cookieFile = argv[++i];
      if (!opts.cookieFile) throw new Error("--cookie-file requires a path");
    } else if (a === "--created-by") {
      opts.createdBy = argv[++i];
      if (!opts.createdBy) throw new Error("--created-by requires a value");
    } else if (a === "--class-id") {
      opts.classId = argv[++i];
      if (!opts.classId) throw new Error("--class-id requires a value");
    } else if (a === "--slug") {
      opts.slug = argv[++i];
    } else if (a === "--title") {
      opts.title = argv[++i];
    } else if (a === "--description") {
      opts.description = argv[++i];
    } else if (a === "--public") {
      opts.isPublic = true;
    } else if (a === "--populate-api") {
      opts.populateApi = true;
    } else if (a === "--api-base-url") {
      opts.apiBaseUrl = argv[++i];
      if (!opts.apiBaseUrl) throw new Error("--api-base-url requires a value");
    } else if (a === "--api-token") {
      opts.apiToken = argv[++i];
      if (!opts.apiToken) throw new Error("--api-token requires a value");
    } else if (a === "--delay") {
      opts.delayMs = parseInt(argv[++i], 10);
      if (!Number.isFinite(opts.delayMs) || opts.delayMs < 0) {
        throw new Error("--delay must be a non-negative number");
      }
    } else if (a === "--batch-delay") {
      opts.batchDelayMs = parseInt(argv[++i], 10);
      if (!Number.isFinite(opts.batchDelayMs) || opts.batchDelayMs < 0) {
        throw new Error("--batch-delay must be a non-negative number");
      }
    } else if (a === "--max-consecutive-fails") {
      opts.maxConsecutiveFails = parseInt(argv[++i], 10);
      if (!Number.isFinite(opts.maxConsecutiveFails) || opts.maxConsecutiveFails < 1) {
        throw new Error("--max-consecutive-fails must be a positive number");
      }
    } else if (a === "--retries") {
      opts.retries = parseInt(argv[++i], 10);
      if (!Number.isFinite(opts.retries) || opts.retries < 0) {
        throw new Error("--retries must be a non-negative number");
      }
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else if (!opts.url) {
      opts.url = a;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }
  return opts;
}

function resolveCookieInput(opts) {
  if (opts.cookieFile) {
    return fs.readFileSync(opts.cookieFile, "utf8");
  }
  return opts.cookie;
}

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/+$/, "");
}

function endpointForSkill(skill) {
  if (skill === "listening") return "/listening/assignments";
  if (skill === "reading") return "/reading/assignments";
  if (skill === "writing") return "/writing/assignments";
  if (skill === "speaking") return "/speaking/assignments";
  throw new Error(`Unsupported skill for API populate: ${skill}`);
}

async function pushAssignmentToApi({ data, opts }) {
  const skill = data.skill;
  const assignment = data.assignment;
  if (!assignment || typeof assignment !== "object") {
    throw new Error("Missing assignment payload from scraper output");
  }

  const baseUrl = normalizeBaseUrl(opts.apiBaseUrl);
  const endpoint = endpointForSkill(skill);
  const url = `${baseUrl}${endpoint}`;

  let httpsAgent;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(baseUrl);
  if (isLocalhost && baseUrl.startsWith("https")) {
    const https = await import("node:https");
    httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }

  const res = await withRetry(
    () =>
      axios.post(url, assignment, {
        timeout: 60000,
        ...(httpsAgent ? { httpsAgent } : {}),
        headers: {
          Authorization: `Bearer ${opts.apiToken}`,
          "Content-Type": "application/json",
        },
        validateStatus: (s) => s < 500,
      }),
    { retries: opts.retries, delayMs: opts.delayMs },
  );

  if (res.status >= 400) {
    const body = typeof res.data === "string" ? res.data.slice(0, 300) : JSON.stringify(res.data).slice(0, 300);
    throw new Error(`API ${res.status} ${url}: ${body}`);
  }

  return { url, status: res.status, response: res.data };
}

const USAGE = `Usage:
  Single test:  node index.js <test-url> [options]
  Batch:        node index.js --discover [options]

Options:
  --cookie "k=v; ..."       Session cookies
  --cookie-file path        Cookie file (Netscape or raw format)
  --skill listening,reading Filter by skill (comma-separated)
  --max-pages N             Max listing pages to crawl (default: 50)
  --out file.json           Output file (single mode)
  --out-dir ./output/       Output directory (batch mode)
  --created-by user         Assignment created_by field
  --class-id id             Assignment class_id field
  --slug slug               Override slug
  --title text              Override title
  --description text        Override description
  --public                  Set is_public = true
  --populate-api            POST assignment to deployed API
  --api-base-url url        API base URL (or ASSIGNMENTS_API_URL)
  --api-token token         Bearer token (or ASSIGNMENTS_API_TOKEN)
  --delay ms                Delay between requests (default: 400)
  --batch-delay ms          Delay between tests in batch mode (default: 3000)
  --max-consecutive-fails n Abort batch after N consecutive scrape failures (default: 5)
  --retries n               Retry count (default: 3)`;

async function runSingle(opts) {
  const cookieInput = resolveCookieInput(opts);
  const skillFilter = opts.skill ? opts.skill.split(",")[0] : null;

  const data = await scrapeTest(opts.url, {
    skill: skillFilter,
    delayMs: opts.delayMs,
    retries: opts.retries,
    cookieInput,
    createdBy: opts.createdBy,
    classId: opts.classId,
    isPublic: opts.isPublic,
    slug: opts.slug,
    title: opts.title,
    description: opts.description,
  });

  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (opts.outFile) {
    fs.writeFileSync(opts.outFile, json, "utf8");
    console.error(`[done] Wrote ${opts.outFile}`);
  } else {
    process.stdout.write(json);
  }

  if (opts.populateApi) {
    try {
      const pushed = await pushAssignmentToApi({ data, opts });
      console.error(
        `[populate] ${data.skill} ${data.assignment?.slug ?? "(no-slug)"} → ${pushed.status} ${pushed.url}`,
      );
    } catch (err) {
      console.error(`[populate] FAILED: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

async function runBatch(opts) {
  const cookieInput = resolveCookieInput(opts);
  const skillFilter = opts.skill ? opts.skill.split(",").map((s) => s.trim().toLowerCase()) : null;

  const { client, jar } = createAxios();
  await seedCookieJar(jar, "https://study4.com", cookieInput);

  const getPage = (url, referer) =>
    withRetry(
      () => client.get(url, { headers: referer ? { Referer: referer } : {} }),
      { retries: opts.retries, delayMs: opts.delayMs },
    );

  console.error("[discover] Starting test discovery...");
  const tests = await discoverTests(getPage, {
    maxPages: opts.maxPages,
    skillFilter,
    delayMs: opts.delayMs,
  });

  console.error(`[discover] Found ${tests.length} tests total.`);
  if (!tests.length) {
    console.error("[discover] No tests matched. Check --skill filter or cookies.");
    return;
  }

  const outDir = opts.outDir ?? "./output";
  ensureDir(outDir);

  const results = [];
  let success = 0;
  let failed = 0;
  let populated = 0;
  let populateFailed = 0;
  let consecutiveFails = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const label = `[${i + 1}/${tests.length}]`;
    console.error(`${label} Scraping: ${test.title} (${test.skill ?? "unknown"}) ${test.url}`);

    let data;
    try {
      data = await scrapeTest(test.url, {
        skill: test.skill,
        delayMs: opts.delayMs,
        retries: opts.retries,
        cookieInput,
        createdBy: opts.createdBy,
        classId: opts.classId,
        isPublic: opts.isPublic,
      });
    } catch (err) {
      const isSessionDead =
        /login/i.test(err.message) ||
        /session/i.test(err.message) ||
        /No question IDs/i.test(err.message);

      console.error(`${label} SCRAPE FAILED: ${err.message}`);
      results.push({ url: test.url, skill: test.skill, status: "error", error: err.message });
      failed++;
      consecutiveFails++;

      if (isSessionDead && consecutiveFails >= opts.maxConsecutiveFails) {
        console.error(
          `\n[batch] ABORTING: ${consecutiveFails} consecutive failures — session likely expired.` +
            `\n        Re-export cookies from your browser and update the cookie file.`,
        );
        break;
      }

      if (i < tests.length - 1) await sleep(opts.batchDelayMs);
      continue;
    }

    consecutiveFails = 0;
    const skill = data.skill ?? "unknown";
    const slug = data.assignment?.slug ?? slugify(test.title) ?? `test-${i}`;
    const skillDir = path.join(outDir, skill);
    ensureDir(skillDir);

    const filePath = path.join(skillDir, `${slug}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.error(`${label} SCRAPED → ${filePath}`);
    results.push({ url: test.url, skill, slug, file: filePath, status: "ok" });
    success++;

    if (opts.populateApi) {
      try {
        const pushed = await pushAssignmentToApi({ data, opts });
        console.error(`${label} POPULATED → ${pushed.status} ${pushed.url}`);
        populated++;
      } catch (err) {
        console.error(`${label} POPULATE FAILED: ${err.message}`);
        populateFailed++;
      }
    }

    if (i < tests.length - 1) {
      await sleep(opts.batchDelayMs);
    }
  }

  const parts = [`Success: ${success}`, `Failed: ${failed}`, `Total: ${tests.length}`];
  if (opts.populateApi) parts.push(`Populated: ${populated}`, `Populate failed: ${populateFailed}`);
  console.error(`\n[batch] Done. ${parts.join(", ")}`);

  const summaryPath = path.join(outDir, "_summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.error(`[batch] Summary → ${summaryPath}`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
    return;
  }

  if (!opts.url && !opts.discover) {
    console.error(USAGE);
    process.exit(1);
    return;
  }

  if (opts.populateApi) {
    if (!opts.apiBaseUrl) {
      throw new Error("--populate-api requires --api-base-url or ASSIGNMENTS_API_URL");
    }
    if (!opts.apiToken) {
      throw new Error("--populate-api requires --api-token or ASSIGNMENTS_API_TOKEN");
    }
  }

  if (opts.discover) {
    await runBatch(opts);
  } else {
    await runSingle(opts);
  }
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
