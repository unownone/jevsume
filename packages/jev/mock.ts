import type {
  Answer,
  ChoiceAnswer,
  JudgmentProvider,
  Questions,
  ScoreAnswer,
  SystemOneRequest,
  SystemOneResult,
} from "./types.ts";
import { LEADERSHIP_VERBS } from "./questions.ts";
import { assertNever } from "./types.ts";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function countMatches(haystack: string, pattern: RegExp): number {
  const matches = haystack.match(pattern);
  return matches ? matches.length : 0;
}

function resumeBlob(state: unknown): string {
  try {
    return JSON.stringify(state).toLowerCase();
  } catch {
    return String(state).toLowerCase();
  }
}

function scoreFromSignals(levelHint: number): ScoreAnswer {
  const bounded = Math.min(4, Math.max(0, levelHint));
  const low = Math.floor(bounded);
  const high = Math.min(4, low + 1);
  const frac = bounded - low;
  const probabilities: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 };
  probabilities[String(low)] = 1 - frac;
  probabilities[String(high)] = (probabilities[String(high)] ?? 0) + frac;
  const legend: Record<string, string> = {
    "0": "level-0",
    "1": "level-1",
    "2": "level-2",
    "3": "level-3",
    "4": "level-4",
  };
  const peak = Math.max(...Object.values(probabilities));
  return {
    type: "score",
    score: Number(bounded.toFixed(3)),
    legend,
    probabilities,
    confidence: Number(peak.toFixed(3)),
  };
}

function peakedChoice(options: string[], winner: string): ChoiceAnswer {
  const probabilities: Record<string, number> = {};
  const rest = Math.max(options.length - 1, 1);
  for (const option of options) {
    probabilities[option] = option === winner ? 0.7 : 0.3 / rest;
  }
  return {
    type: "choice",
    choice: winner,
    probabilities,
    confidence: 0.7,
  };
}

function answerQuestion(
  id: string,
  question: Questions[string],
  blob: string,
): Answer {
  switch (question.type) {
    case "score": {
      const digits = countMatches(blob, /\d+/g);
      const bullets = countMatches(blob, /\n\s*[-*•]/g);
      const lengthPenalty = blob.length > 12000 ? 0.8 : blob.length > 4000 ? 0.4 : 0;
      let hint = 2.1;
      if (id.includes("metrics") || id.includes("evidence")) {
        hint = 1.2 + Math.min(2.4, digits * 0.25);
      } else if (id.includes("structure") || id.includes("ats_parse")) {
        hint = 1.6 + Math.min(2, bullets * 0.2);
        if (blob.includes("experience") && blob.includes("skills")) {
          hint += 0.6;
        }
      } else if (id.includes("conciseness")) {
        hint = 3.2 - lengthPenalty;
      } else if (id.includes("wording")) {
        hint = blob.includes("responsible for") ? 1.4 : 2.8;
      } else if (id.includes("keyword") || id.includes("fit_overall")) {
        hint = blob.includes("persona") ? 2.6 : 2.2;
        if (digits > 3) {
          hint += 0.4;
        }
      }
      return scoreFromSignals(hint);
    }
    case "noul": {
      let noul = 0.42;
      if (id === "role_over_six") {
        noul = countMatches(blob, /\n\s*[-*•]/g) > 6 ? 0.82 : 0.18;
      } else if (id === "skill_unproven") {
        noul = /skills/.test(blob) && !/experience[\s\S]{0,80}(python|kafka|golang|\bgo\b)/.test(blob) ? 0.7 : 0.22;
      } else if (id === "skill_duplicate") {
        noul = /(python.*){2,}|(kafka.*){2,}|(\bgo\b.*){2,}/.test(blob) ? 0.8 : 0.2;
      } else if (id.startsWith("has_summary")) {
        noul = /summary|profile|objective/.test(blob) ? 0.86 : 0.18;
      } else if (id.startsWith("has_experience")) {
        noul = /experience|engineer|developer|manager/.test(blob) ? 0.9 : 0.2;
      } else if (id.startsWith("has_skills")) {
        noul = /skills|python|typescript|golang|java/.test(blob) ? 0.88 : 0.22;
      } else if (id.startsWith("req_c")) {
        const marketing = /benefit|pto|culture of|we are a|equal opportunity/.test(blob);
        noul = marketing && id.endsWith("0") ? 0.2 : 0.78;
      } else if (id.includes("_covered") || id.startsWith("frag_")) {
        noul = clamp01(0.35 + countMatches(blob, /\d+/g) * 0.08);
      }
      return { type: "noul", noul: Number(noul.toFixed(3)) };
    }
    case "choice": {
      const options = Object.keys(question.criteria);
      let winner = options[0] ?? "other";
      if (id === "leadership_repeat") {
        const peak = Math.max(
          ...LEADERSHIP_VERBS.map((word) => countMatches(blob, new RegExp(`\\b${word}\\b`, "g"))),
        );
        winner = peak >= 3 ? "repeated" : peak > 0 ? "once" : "none";
        if (!options.includes(winner)) {
          winner = options[0] ?? "none";
        }
      } else if (id === "weakest_dimension") {
        winner = countMatches(blob, /\d+/g) < 2 ? "metrics" : "none";
        if (!options.includes(winner)) {
          winner = options[0] ?? "none";
        }
      } else if (id.startsWith("cat_c")) {
        winner = /benefit|pto|equal opportunity/.test(blob)
          ? "not_a_requirement"
          : "must_have";
        if (!options.includes(winner)) {
          winner = options[0] ?? "must_have";
        }
      } else if (id.includes("_verdict")) {
        winner = countMatches(blob, /\d+/g) > 2 ? "works" : "partial";
        if (!options.includes(winner)) {
          winner = options.includes("missing") ? "missing" : (options[0] ?? "missing");
        }
      } else if (id.includes("_kind")) {
        if (blob.includes("education")) {
          winner = "education";
        } else if (blob.includes("skill")) {
          winner = "skills";
        } else {
          winner = "experience";
        }
        if (!options.includes(winner)) {
          winner = options[0] ?? "other";
        }
      }
      return peakedChoice(options, winner);
    }
    default: {
      const _exhaustive: never = question;
      return assertNever(_exhaustive, "Unhandled question type");
    }
  }
}

/**
 * Deterministic stand-in so local/dev/tests work without TYPESAFE_API_KEY.
 * Not calibrated; live Jev is the production path.
 */
export class MockJudgmentProvider implements JudgmentProvider {
  readonly id = "mock" as const;

  async evaluate(input: SystemOneRequest): Promise<SystemOneResult> {
    const blob = resumeBlob(input.state);
    const answers: Record<string, Answer> = {};
    for (const [id, question] of Object.entries(input.questions)) {
      answers[id] = answerQuestion(id, question, blob);
    }
    return {
      model: "mock-jev",
      answers,
      usage: {
        input_tokens: Math.max(1, Math.ceil(JSON.stringify(input).length / 4)),
        output_tokens: 0,
      },
    };
  }
}
