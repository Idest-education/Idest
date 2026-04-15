import * as cheerio from "cheerio";
import { resolveUrl, extractJsString, htmlToMarkdown, extractImagesFromHtml } from "./utils.js";

// ── Shared helpers ──────────────────────────────────────────────────────────

function pickTestForm($) {
  const byAction = $('form[action*="finish"]').first();
  if (byAction.length) return byAction;
  const byId = $("#test-form").first();
  if (byId.length) return byId;
  return $("form").first();
}

function collectHiddenFields($form) {
  const out = {};
  $form.find('input[type="hidden"]').each((_, el) => {
    const name = el.attribs.name;
    if (!name) return;
    out[name] = el.attribs.value ?? "";
  });
  return out;
}

function normalizeText(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCorrectAnswer(raw) {
  return String(raw ?? "")
    .replace(/^đáp án đúng\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get the inner HTML of a cheerio element, then convert to markdown.
 */
function getInnerMd($el) {
  if (!$el || !$el.length) return "";
  return htmlToMarkdown($el.html());
}

/**
 * Extract clean title from <h1>, stripping nav buttons like "Thoát".
 */
function extractCleanTitle($) {
  const $h1 = $("h1").first();
  if (!$h1.length) {
    return normalizeText($("title").text()).replace(/\s*-\s*STUDY4$/i, "").trim() || "Study4 Assignment";
  }
  const $clone = $h1.clone();
  $clone.find("a, button, .btn").remove();
  return normalizeText($clone.text()) || "Study4 Assignment";
}

function detectInputType($wrapper, $) {
  if ($wrapper.find('input[type="radio"][data-type="question-answer"]').length) return "radio";
  if ($wrapper.find('input[type="checkbox"][data-type="question-answer"]').length) return "checkbox";
  if ($wrapper.find('input[type="text"][data-type="question-answer"]').length) return "text";
  if ($wrapper.find('textarea[data-type="question-answer"]').length) return "textarea";
  if ($wrapper.find('input[type="text"]').length) return "text";
  return "text";
}

function extractMcOptions($wrapper, $) {
  const options = [];
  $wrapper.find('input[type="radio"][data-type="question-answer"], input[type="checkbox"][data-type="question-answer"]').each((_, el) => {
    const $input = $(el);
    const value = $input.attr("value") ?? "";
    const $label = $input.closest(".form-check, .question-answer-item, label").first();
    const labelText = normalizeText($label.text()).replace(/^\s*[A-Z]\.\s*/, "");
    options.push({ id: value, label_md: labelText || value });
  });
  return options;
}

// ── Test page parser (section-aware) ────────────────────────────────────────

export function parseTestPage(html, pageUrl, skill) {
  const $ = cheerio.load(html);

  const csrfFromInput =
    $('input[name="csrfmiddlewaretoken"]').attr("value") ??
    $('input[name="csrfmiddlewaretoken"]').val() ??
    null;
  const csrf = csrfFromInput ?? extractJsString(html, "window.csrf_token");
  if (!csrf) {
    throw new Error("Could not find csrfmiddlewaretoken on test page");
  }

  const $form = pickTestForm($);
  const hidden = collectHiddenFields($form);
  const title = extractCleanTitle($);

  const sections = [];
  const allQuestionIds = [];

  const $tabPanes = $form.find('div.tab-pane[id^="partcontent-"]');

  if ($tabPanes.length > 0) {
    $tabPanes.each((sectionIdx, pane) => {
      const $pane = $(pane);
      const section = parseSectionFromPane($, $pane, pageUrl, sectionIdx, skill);
      sections.push(section);
      for (const g of section.question_groups) {
        for (const q of g.questions) {
          allQuestionIds.push(q.source_qid);
        }
      }
    });
  } else {
    const section = parseSectionFromContainer($, $form, pageUrl, 0, skill);
    sections.push(section);
    for (const g of section.question_groups) {
      for (const q of g.questions) {
        allQuestionIds.push(q.source_qid);
      }
    }
  }

  return { $, csrf, hidden, title, sections, allQuestionIds };
}

// ── Section parsers ─────────────────────────────────────────────────────────

function parseSectionFromPane($, $pane, pageUrl, sectionIdx, skill) {
  const paneId = $pane.attr("id") ?? "";
  const tabLabel = normalizeText($(`a[href="#${paneId}"]`).text());
  const sectionTitle = tabLabel || `Section ${sectionIdx + 1}`;

  const $audio = $pane.find("audio source").first();
  const audioUrl = resolveUrl(pageUrl, $audio.attr("src"));

  let passageHtml = "";
  let passageImages = [];
  let writingPrompt = "";
  let speakingPrompt = "";

  if (skill === "reading") {
    // Reading passage lives in question-twocols-left or top-level context-content
    $pane.find(".question-twocols-left .context-content.text-highlightable").each((_, el) => {
      const $ctx = $(el);
      const h = $ctx.html();
      if (h && h.length > 50) {
        passageHtml += h + "\n\n";
        passageImages.push(...extractImagesFromHtml(h));
      }
    });
    if (!passageHtml) {
      $pane.find(".context-content.text-highlightable").each((_, el) => {
        const $ctx = $(el);
        if ($ctx.closest(".question-group-wrapper").length) return;
        if ($ctx.closest(".question-item-wrapper").length) return;
        const h = $ctx.html();
        if (h && h.length > 50) {
          passageHtml += h + "\n\n";
          passageImages.push(...extractImagesFromHtml(h));
        }
      });
    }
  } else if (skill === "writing") {
    // Writing prompt lives in question-twocols-left inside question-item-wrapper
    $pane.find(".question-item-wrapper .question-twocols-left .context-content.text-highlightable").each((_, el) => {
      const h = $(el).html();
      if (h && h.length > 20) {
        writingPrompt += htmlToMarkdown(h) + "\n\n";
        passageImages.push(...extractImagesFromHtml(h));
      }
    });
    // Fallback: any context-content in the pane
    if (!writingPrompt) {
      $pane.find(".context-content.text-highlightable").each((_, el) => {
        const h = $(el).html();
        if (h && h.length > 20) writingPrompt += htmlToMarkdown(h) + "\n\n";
      });
    }
  } else if (skill === "speaking") {
    // Speaking prompt lives in question-twocols-left or direct context-content blocks
    $pane.find(".question-twocols-left .context-content.text-highlightable, .context-content.text-highlightable").each((_, el) => {
      const h = $(el).html();
      if (h && h.length > 10) speakingPrompt += htmlToMarkdown(h) + "\n\n";
    });
  }

  const questionGroups = parseQuestionGroups($, $pane, skill);

  return {
    sectionIndex: sectionIdx,
    title: sectionTitle,
    audioUrl,
    passageMd: passageHtml ? htmlToMarkdown(passageHtml) : "",
    passageImages,
    writingPrompt: writingPrompt.trim(),
    speakingPrompt: speakingPrompt.trim(),
    question_groups: questionGroups,
  };
}

function parseSectionFromContainer($, $container, pageUrl, sectionIdx, skill) {
  const $audio = $container.find("audio source").first();
  const audioUrl = resolveUrl(pageUrl, $audio.attr("src"));

  let passageHtml = "";
  let passageImages = [];
  let writingPrompt = "";
  let speakingPrompt = "";

  if (skill === "reading") {
    $container.find(".question-twocols-left .context-content.text-highlightable").each((_, el) => {
      const h = $(el).html();
      if (h && h.length > 50) {
        passageHtml += h + "\n\n";
        passageImages.push(...extractImagesFromHtml(h));
      }
    });
    if (!passageHtml) {
      $container.find(".context-content.text-highlightable").each((_, el) => {
        const $ctx = $(el);
        if ($ctx.closest(".question-group-wrapper").length) return;
        if ($ctx.closest(".question-item-wrapper").length) return;
        const h = $ctx.html();
        if (h && h.length > 50) {
          passageHtml += h + "\n\n";
          passageImages.push(...extractImagesFromHtml(h));
        }
      });
    }
  } else if (skill === "writing") {
    $container.find(".question-item-wrapper .question-twocols-left .context-content.text-highlightable").each((_, el) => {
      const h = $(el).html();
      if (h && h.length > 20) {
        writingPrompt += htmlToMarkdown(h) + "\n\n";
        passageImages.push(...extractImagesFromHtml(h));
      }
    });
    if (!writingPrompt) {
      $container.find(".context-content.text-highlightable").each((_, el) => {
        const h = $(el).html();
        if (h && h.length > 20) writingPrompt += htmlToMarkdown(h) + "\n\n";
      });
    }
  } else if (skill === "speaking") {
    $container.find(".question-twocols-left .context-content.text-highlightable, .context-content.text-highlightable").each((_, el) => {
      const h = $(el).html();
      if (h && h.length > 10) speakingPrompt += htmlToMarkdown(h) + "\n\n";
    });
  }

  const questionGroups = parseQuestionGroups($, $container, skill);

  return {
    sectionIndex: sectionIdx,
    title: "Section 1",
    audioUrl,
    passageMd: passageHtml ? htmlToMarkdown(passageHtml) : "",
    passageImages,
    writingPrompt: writingPrompt.trim(),
    speakingPrompt: speakingPrompt.trim(),
    question_groups: questionGroups,
  };
}

// ── Question group parser ───────────────────────────────────────────────────

function parseQuestionGroups($, $container, skill) {
  const groups = [];
  const $groupWrappers = $container.find(".question-group-wrapper");

  if ($groupWrappers.length > 0) {
    $groupWrappers.each((groupIdx, gw) => {
      const $gw = $(gw);
      const group = parseOneQuestionGroup($, $gw, groupIdx, skill);
      groups.push(group);
    });
  } else {
    const group = parseOneQuestionGroup($, $container, 0, skill);
    if (group.questions.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

function parseOneQuestionGroup($, $groupContainer, groupIdx, skill) {
  // Instructions: context-content blocks that belong to the group header,
  // NOT inside individual question wrappers, NOT the passage column
  let instructionsHtml = "";
  let instructionImages = [];

  $groupContainer.find(".context-content.text-highlightable, .context-content").each((_, el) => {
    const $ctx = $(el);
    if ($ctx.hasClass("context-audio")) return;
    if ($ctx.closest(".question-item-wrapper").length) return;
    // For reading, the left column holds the passage – skip it here.
    // For listening, the left column holds instructions/diagrams – keep it.
    if (skill === "reading" && $ctx.closest(".question-twocols-left").length) return;
    const h = $ctx.html();
    if (h && h.length > 10) {
      instructionsHtml += h + "\n";
      instructionImages.push(...extractImagesFromHtml(h));
    }
  });

  const instructionsMd = htmlToMarkdown(instructionsHtml);

  const questions = [];
  const seen = new Set();

  $groupContainer.find(".question-wrapper[data-qid]").each((_, el) => {
    const $qw = $(el);
    const qid = parseInt($qw.attr("data-qid"), 10);
    if (!Number.isFinite(qid) || seen.has(qid)) return;
    seen.add(qid);

    const $numberEl = $qw.find(".question-number").first();
    const questionNumber = normalizeText($numberEl.text()).replace(/\D/g, "");

    const inputType = detectInputType($qw, $);
    let schemaType = "short_answer";
    let interaction = { placeholder: "Type your answer", max_length: 200 };

    if (inputType === "radio") {
      schemaType = "multiple_choice_single";
      interaction = { options: extractMcOptions($qw, $) };
    } else if (inputType === "checkbox") {
      schemaType = "multiple_choice_multi";
      const opts = extractMcOptions($qw, $);
      interaction = { options: opts, min_select: 1, max_select: opts.length };
    }

    // Prompt: get question text as markdown (strip answer inputs)
    const $content = $qw.find(".question-content").first();
    let promptMd = "";
    if ($content.length) {
      const $clone = $content.clone();
      $clone.find(".question-answers, input, textarea, select").remove();
      const promptHtml = $clone.html();
      promptMd = htmlToMarkdown(promptHtml);
    }

    questions.push({
      source_qid: qid,
      questionNumber: questionNumber || String(questions.length + 1),
      schemaType,
      promptMd,
      interaction,
      inputType,
    });
  });

  // Fallback: collect from input names
  if (!questions.length) {
    $groupContainer.find('input[name^="question-"], textarea[name^="question-"]').each((_, el) => {
      const name = el.attribs.name ?? "";
      const m = name.match(/^question-(\d+)$/);
      if (!m) return;
      const qid = parseInt(m[1], 10);
      if (!Number.isFinite(qid) || seen.has(qid)) return;
      seen.add(qid);
      questions.push({
        source_qid: qid,
        questionNumber: String(questions.length + 1),
        schemaType: "short_answer",
        promptMd: "",
        interaction: { placeholder: "Type your answer", max_length: 200 },
        inputType: "text",
      });
    });
  }

  return {
    groupIndex: groupIdx,
    instructionsMd,
    instructionImages,
    questions,
  };
}

// ── Structured explanation parser ───────────────────────────────────────────

function parseStructuredExplanation($, $wrapper) {
  const $collapse = $wrapper.find(".collapse, [class*='explanation']").first();
  if (!$collapse.length) {
    const fallbackText = normalizeText($wrapper.find(".explanation, .answer-explanation").text());
    return fallbackText ? { explain: fallbackText } : null;
  }

  const rawHtml = $collapse.html() ?? "";
  const rawText = normalizeText($collapse.text());
  if (!rawText) return null;

  let cite = "";
  let keywords = "";
  let explain = "";

  const stripHtml = (html) => normalizeText(cheerio.load(html).root().text());

  const citeMatch = rawHtml.match(/Tr[ií]ch\s+đoạn\s+chứa\s+đáp\s+[aá]n\s*:?\s*<\/b>\s*([\s\S]*?)(?=<b>|$)/i);
  if (citeMatch) cite = stripHtml(citeMatch[1]);

  const kwMatch = rawHtml.match(/Keywords?\s*:?\s*<\/b>\s*([\s\S]*?)(?=<b>|$)/i);
  if (kwMatch) keywords = stripHtml(kwMatch[1]);

  const explainMatch = rawHtml.match(/Gi[aả]i\s+th[ií]ch\s*:?\s*<\/b>\s*([\s\S]*?)$/i);
  if (explainMatch) explain = stripHtml(explainMatch[1]);

  if (!cite && !keywords && !explain) {
    return { explain: rawText };
  }
  const result = {};
  if (cite) result.cite = cite;
  if (keywords) result.keywords = keywords;
  if (explain) result.explain = explain;
  return result;
}

// ── Details page parser (section-aware) ─────────────────────────────────────

export function parseDetailsPage(html) {
  const $ = cheerio.load(html);

  const stripTranscriptPrefix = (txt) =>
    txt.replace(/^Hiện Transcript\s*/i, "").replace(/^Show Transcript\s*/i, "").trim();

  const transcripts = [];
  $(".context-transcript").each((_, el) => {
    const txt = stripTranscriptPrefix(normalizeText($(el).text()));
    if (txt.length > 10) transcripts.push(txt);
  });
  const fullTranscript = transcripts.join("\n\n");

  const sectionTranscripts = [];
  const $tabPanes = $('div.tab-pane[id^="partcontent-"]');
  if ($tabPanes.length > 0) {
    $tabPanes.each((_, pane) => {
      const $pane = $(pane);
      const txts = [];
      $pane.find(".context-transcript").each((_, el) => {
        const txt = stripTranscriptPrefix(normalizeText($(el).text()));
        if (txt.length > 10) txts.push(txt);
      });
      sectionTranscripts.push(txts.join("\n\n"));
    });
  }

  const detailRows = [];
  $(".question-item-wrapper").each((_, wrap) => {
    const $w = $(wrap);
    const qidAttr =
      $w.attr("data-qid") ??
      $w.find("[data-qid]").first().attr("data-qid") ??
      null;
    const qid = qidAttr != null ? parseInt(String(qidAttr), 10) : null;

    let number = null;
    const $num = $w.find(".question-number, .q-number, [class*='question-num']").first();
    if ($num.length) number = normalizeText($num.text());
    if (!number) {
      const m = $w.text().match(/question\s*#?\s*(\d+)/i);
      if (m) number = m[1];
    }

    const correctAnswer = normalizeText(
      $w.find(".text-success").first().text() ||
      $w.find('[class*="correct-answer"]').first().text()
    );

    const explanation = parseStructuredExplanation($, $w);

    detailRows.push({
      number,
      correctAnswer,
      explanation,
      qid: Number.isFinite(qid) ? qid : null,
    });
  });

  return { fullTranscript, sectionTranscripts, detailRows };
}

export function mergeDetailsIntoSections(sections, detailRows) {
  const byQid = new Map();
  for (const row of detailRows) {
    if (row.qid != null) byQid.set(row.qid, row);
  }

  let rowIndex = 0;
  for (const section of sections) {
    for (const group of section.question_groups) {
      for (const q of group.questions) {
        const detail = byQid.get(q.source_qid) ?? detailRows[rowIndex] ?? null;
        q.correctAnswer = detail ? normalizeCorrectAnswer(detail.correctAnswer) : "";
        q.explanation = detail?.explanation ?? null;
        rowIndex++;
      }
    }
  }
}

// ── Page detection helpers ──────────────────────────────────────────────────

export function canParseAsTestPage(html) {
  const $ = cheerio.load(html);
  const hasFinishAction = $('form[action*="/finish/"]').length > 0;
  const hasQuestionMarkers =
    $("[data-qid]").length > 0 ||
    $('input[name^="question-"], textarea[name^="question-"]').length > 0;
  return hasFinishAction && hasQuestionMarkers;
}

export function extractStartUrlFromLanding(html, landingUrl) {
  const $ = cheerio.load(html);
  const href =
    $('a[href*="/start/"]').first().attr("href") ??
    $('form[action*="/start/"]').first().attr("action") ??
    null;
  return resolveUrl(landingUrl, href);
}

export function looksLikeLoginPage(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().toLowerCase();
  const canonical = $('link[rel="canonical"]').attr("href") ?? "";
  return (
    $('form[action*="/login"]').length > 0 ||
    $('a[href*="/oauth/login/"]').length > 0 ||
    /\b(log in|login)\b/i.test(title) ||
    /\/login\/\?next=/i.test(canonical) ||
    /đăng nhập với facebook|đăng nhập với google/i.test($.text())
  );
}

export function detectSkillFromPage(html) {
  const $ = cheerio.load(html);
  const tags = [];
  $(".tag, .badge").each((_, el) => {
    tags.push(normalizeText($(el).text()).toLowerCase());
  });
  const title = normalizeText($("h1").first().text()).toLowerCase();
  const allText = tags.join(" ") + " " + title;

  if (allText.includes("listening")) return "listening";
  if (allText.includes("reading")) return "reading";
  if (allText.includes("writing")) return "writing";
  if (allText.includes("speaking")) return "speaking";
  return null;
}
