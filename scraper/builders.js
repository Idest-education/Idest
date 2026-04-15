import { randomUUID } from "node:crypto";

// ── Shared ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function baseFields({ title, description, slug, createdBy, classId, isPublic }) {
  return {
    created_by: createdBy ?? "study4-scraper",
    ...(classId ? { class_id: classId } : {}),
    slug: slug ?? slugify(title) ?? `study4-${Date.now()}`,
    title,
    ...(description ? { description } : {}),
    is_public: Boolean(isPublic),
    schema_version: 1,
  };
}

function toMediaAsset(img) {
  return {
    id: randomUUID(),
    kind: "image",
    url: img.url,
    ...(img.alt ? { alt: img.alt } : {}),
    ...(img.width ? { width: img.width } : {}),
    ...(img.height ? { height: img.height } : {}),
  };
}

function buildExplanation(q) {
  if (!q.explanation) return undefined;
  if (typeof q.explanation === "string") {
    return q.explanation ? { explain: q.explanation } : undefined;
  }
  const { cite, keywords, explain } = q.explanation;
  if (!cite && !keywords && !explain) return undefined;
  const out = {};
  if (cite) out.cite = cite;
  if (keywords) out.keywords = keywords;
  if (explain) out.explain = explain;
  return out;
}

function buildQuestion(q, orderIndex) {
  const base = {
    id: randomUUID(),
    order_index: orderIndex,
    type: q.schemaType,
    prompt_md: q.promptMd || `Question ${q.questionNumber}`,
  };

  const explanation = buildExplanation(q);
  if (explanation) base.explanation = explanation;

  switch (q.schemaType) {
    case "multiple_choice_single": {
      const options = q.interaction?.options ?? [];
      return {
        ...base,
        interaction: { options },
        answer_key: { choice: q.correctAnswer || "" },
      };
    }
    case "multiple_choice_multi": {
      const options = q.interaction?.options ?? [];
      const answers = q.correctAnswer
        ? q.correctAnswer.split(/[,&]/).map((s) => s.trim()).filter(Boolean)
        : [];
      return {
        ...base,
        interaction: {
          options,
          min_select: q.interaction?.min_select ?? 1,
          max_select: q.interaction?.max_select ?? options.length,
        },
        answer_key: { choices: answers },
      };
    }
    case "gap_fill_template": {
      const blanks = q.interaction?.blanks ?? [{ id: `blank-${q.source_qid}`, placeholder_label: "" }];
      const blankAnswers = {};
      if (blanks.length === 1) {
        blankAnswers[blanks[0].id] = q.correctAnswer || "";
      } else {
        for (const b of blanks) {
          blankAnswers[b.id] = q.correctAnswer || "";
        }
      }
      return {
        ...base,
        interaction: { blanks },
        answer_key: { blanks: blankAnswers },
      };
    }
    case "form_completion": {
      const blanks = q.interaction?.blanks ?? [{ id: `blank-${q.source_qid}`, placeholder_label: "" }];
      const blankAnswers = {};
      for (const b of blanks) {
        blankAnswers[b.id] = q.correctAnswer || "";
      }
      return {
        ...base,
        interaction: { blanks },
        answer_key: { blanks: blankAnswers },
      };
    }
    default: {
      return {
        ...base,
        type: "short_answer",
        interaction: {
          placeholder: q.interaction?.placeholder ?? "Type your answer",
          max_length: q.interaction?.max_length ?? 200,
        },
        answer_key: { correct_answer: q.correctAnswer || "" },
      };
    }
  }
}

function buildQuestionGroup(group, groupOrderIndex) {
  const questions = group.questions.map((q, i) => buildQuestion(q, i + 1));

  const images = (group.instructionImages ?? []).map(toMediaAsset);

  const result = {
    id: randomUUID(),
    order_index: groupOrderIndex,
    questions,
  };

  if (group.instructionsMd) {
    result.instructions_md = group.instructionsMd;
    if (images.length) {
      result.stimulus = { media: images };
    }
  } else {
    result.title = `Question Group ${groupOrderIndex}`;
  }

  return result;
}

// ── Listening Assignment Builder ────────────────────────────────────────────

export function buildListeningAssignment(meta, sections, sectionTranscripts) {
  const builtSections = sections.map((section, idx) => {
    const transcript = sectionTranscripts?.[idx] ?? "";
    const questionGroups = section.question_groups.map((g, gi) =>
      buildQuestionGroup(g, gi + 1),
    );

    return {
      id: randomUUID(),
      title: section.title || `Recording ${idx + 1}`,
      order_index: idx + 1,
      material: {
        type: "listening",
        audio: {
          id: randomUUID(),
          kind: "audio",
          url: section.audioUrl ?? "",
        },
        transcript_md: transcript,
        images: [],
      },
      question_groups: questionGroups,
    };
  });

  return {
    ...baseFields(meta),
    sections: builtSections,
  };
}

// ── Reading Assignment Builder ──────────────────────────────────────────────

export function buildReadingAssignment(meta, sections) {
  const builtSections = sections.map((section, idx) => {
    const questionGroups = section.question_groups.map((g, gi) =>
      buildQuestionGroup(g, gi + 1),
    );

    const images = (section.passageImages ?? []).map(toMediaAsset);

    return {
      id: randomUUID(),
      title: section.title || `Passage ${idx + 1}`,
      order_index: idx + 1,
      material: {
        type: "reading",
        document_md: section.passageMd || "",
        images,
      },
      question_groups: questionGroups,
    };
  });

  return {
    ...baseFields(meta),
    sections: builtSections,
  };
}

// ── Writing Assignment Builder ──────────────────────────────────────────────

export function buildWritingAssignment(meta, sections) {
  const tasks = sections.map((section, idx) => {
    const images = (section.passageImages ?? []).map(toMediaAsset);
    const hasStimulus = images.length > 0 || section.passageMd;
    return {
      id: randomUUID(),
      task_number: Math.min(idx + 1, 2),
      prompt_md: section.writingPrompt || section.title || `Writing Task ${idx + 1}`,
      ...(hasStimulus
        ? { stimulus: { images, ...(section.passageMd ? { data_description_md: section.passageMd } : {}) } }
        : {}),
    };
  });

  return {
    ...baseFields(meta),
    tasks,
  };
}

// ── Speaking Assignment Builder ─────────────────────────────────────────────

export function buildSpeakingAssignment(meta, sections) {
  const parts = sections.map((section, idx) => ({
    part_number: Math.min(idx + 1, 3),
    question: section.speakingPrompt || section.title || `Speaking Part ${idx + 1}`,
  }));

  return {
    ...baseFields(meta),
    parts,
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export function buildAssignment(skill, meta, sections, sectionTranscripts) {
  switch (skill) {
    case "listening":
      return buildListeningAssignment(meta, sections, sectionTranscripts);
    case "reading":
      return buildReadingAssignment(meta, sections);
    case "writing":
      return buildWritingAssignment(meta, sections);
    case "speaking":
      return buildSpeakingAssignment(meta, sections);
    default:
      throw new Error(`Unknown skill: ${skill}`);
  }
}
