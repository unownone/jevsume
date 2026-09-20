import { describe, expect, it } from "vitest";
import {
  buildGeneralReviewQuestions,
  buildJobReviewQuestions,
  buildPersonaQuestions,
} from "../packages/jev/questions.ts";
import { GENERAL_WEIGHTS, toJevScore } from "../packages/jev/score.ts";
import { TypeSafeHttpError, TypeSafeHttpProvider } from "../packages/jev/http.ts";
import { MockJudgmentProvider } from "../packages/jev/mock.ts";
import {
  requirementsFromPersonaAnswers,
  transformGeneralReview,
  transformJobReview,
} from "../packages/jev/transform.ts";
import type { JobPersona, ResumeSection, ScoreAnswer } from "../packages/jev/types.ts";

const sampleSection: ResumeSection = {
  id: "s1",
  heading: "Experience",
  kind: "experience",
  text: "Built systems that processed 2M events/day",
  start: 0,
  end: 42,
  line: 1,
  fragments: [
    {
      id: "s1-f1",
      text: "Built systems that processed 2M events/day",
      kind: "bullet",
      start: 0,
      end: 42,
      line: 1,
    },
  ],
};

describe("JEV prompt manager", () => {
  it("emits typed general-review questions for dimensions and sections", () => {
    const questions = buildGeneralReviewQuestions(["s1"]);
    expect(questions.wording?.type).toBe("score");
    expect(questions.conciseness?.type).toBe("score");
    expect(questions.structure?.type).toBe("score");
    expect(questions.metrics?.type).toBe("score");
    expect(questions.ats_parse?.type).toBe("score");
    expect(questions.has_summary?.type).toBe("noul");
    expect(questions.weakest_dimension?.type).toBe("choice");
    expect(questions.leadership_repeat?.type).toBe("choice");
    expect(questions.role_over_six?.type).toBe("noul");
    expect(questions.skill_unproven?.type).toBe("noul");
    expect(questions.skill_duplicate?.type).toBe("noul");
    expect(questions.sec_s1_kind?.type).toBe("choice");
    expect(questions.sec_s1_quality?.type).toBe("score");
    expect(Object.keys(questions).some((id) => /trust|honest/i.test(id))).toBe(false);
    expect(JSON.stringify(questions)).not.toMatch(/trustworth/i);
  });

  it("emits persona and job-review questions keyed by candidate/requirement ids", () => {
    const personaQs = buildPersonaQuestions(2);
    expect(personaQs.req_c0?.type).toBe("noul");
    expect(personaQs.cat_c1?.type).toBe("choice");
    const jobQs = buildJobReviewQuestions(["r1"], ["s1"]);
    expect(jobQs.fit_overall?.type).toBe("score");
    expect(jobQs.req_r1_covered?.type).toBe("noul");
    expect(jobQs.req_r1_verdict?.type).toBe("choice");
    expect(jobQs.frag_s1_helps?.type).toBe("noul");
  });
});

describe("JevScore composite", () => {
  it("weights normalized scores in code", () => {
    const scores: Record<string, ScoreAnswer> = {};
    for (const key of Object.keys(GENERAL_WEIGHTS)) {
      scores[key] = {
        type: "score",
        score: 4,
        legend: {},
        probabilities: { "4": 1 },
        confidence: 0.9,
      };
    }
    const result = toJevScore(GENERAL_WEIGHTS, scores, null, 0);
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(0.9);
  });

  it("mixes requirement coverage into job scores", () => {
    const scores = {
      fit_overall: {
        type: "score" as const,
        score: 0,
        legend: {},
        probabilities: { "0": 1 },
        confidence: 0.5,
      },
    };
    const result = toJevScore({ fit_overall: 1 }, scores, 1, 0.25);
    expect(result.value).toBe(25);
  });
});

describe("transformers", () => {
  it("turns general JEV answers into suggestions when metrics are weak", () => {
    const review = transformGeneralReview({
      provider: "mock",
      sections: [sampleSection],
      result: {
        model: "jev-latest",
        answers: {
          wording: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          conciseness: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          structure: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          metrics: {
            type: "score",
            score: 0.5,
            legend: {},
            probabilities: { "0": 1 },
            confidence: 0.8,
          },
          ats_parse: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          weakest_dimension: {
            type: "choice",
            choice: "metrics",
            probabilities: { metrics: 1 },
            confidence: 0.7,
          },
          sec_s1_kind: {
            type: "choice",
            choice: "education",
            probabilities: { education: 1 },
            confidence: 0.9,
          },
        },
      },
    });
    expect(review.mode).toBe("general");
    expect(review.suggestions.some((item) => item.id === "metrics")).toBe(true);
    expect(review.findings.some((item) => item.id === "weakest")).toBe(true);
    expect(review.sections[0]?.kind).toBe("experience");
    const weakest = review.findings.find((item) => item.id === "weakest");
    expect(weakest?.span?.fragmentId).toBe("s1-f1");
    expect(weakest?.suggestedRewrite).toBeTruthy();
    expect(review.suggestions.find((item) => item.id === "metrics")?.span?.fragmentId).toBe(
      "s1-f1",
    );
  });

  it("keeps persona requirements above the noul threshold", () => {
    const kept = requirementsFromPersonaAnswers({
      candidates: [
        { id: "r1", text: "5+ years of Go" },
        { id: "r2", text: "Unlimited PTO" },
      ],
      answers: {
        req_c0: { type: "noul", noul: 0.9 },
        cat_c0: {
          type: "choice",
          choice: "must_have",
          probabilities: { must_have: 1 },
          confidence: 0.8,
        },
        req_c1: { type: "noul", noul: 0.2 },
        cat_c1: {
          type: "choice",
          choice: "not_a_requirement",
          probabilities: { not_a_requirement: 1 },
          confidence: 0.8,
        },
      },
    });
    expect(kept).toEqual([
      { id: "r1", text: "5+ years of Go", category: "must_have", noul: 0.9 },
    ]);
  });

  it("turns closed leadership and skill answers into rewrite suggestions", () => {
    const review = transformGeneralReview({
      provider: "mock",
      sections: [sampleSection],
      result: {
        model: "jev-latest",
        answers: {
          wording: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          conciseness: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          structure: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          metrics: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          ats_parse: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.8,
          },
          weakest_dimension: {
            type: "choice",
            choice: "none",
            probabilities: { none: 1 },
            confidence: 0.7,
          },
          leadership_repeat: {
            type: "choice",
            choice: "repeated",
            probabilities: { repeated: 1 },
            confidence: 0.8,
          },
          role_over_six: { type: "noul", noul: 0.8 },
          skill_unproven: { type: "noul", noul: 0.8 },
          skill_duplicate: { type: "noul", noul: 0.8 },
        },
      },
    });
    expect(review.suggestions.map((item) => item.id)).toEqual(
      expect.arrayContaining(["rotate-verb", "drop-bullet", "destack-skills", "skill-duplicate"]),
    );
  });

  it("maps job requirement verdicts onto findings", () => {
    const persona: JobPersona = {
      id: "p1",
      title: "Staff Engineer",
      tags: ["go"],
      jobDescription: "Build systems",
      createdAt: "2026-09-17T00:00:00.000Z",
      requirements: [
        { id: "r1", text: "Go in production", category: "must_have", noul: 0.9 },
      ],
    };
    const review = transformJobReview({
      persona,
      provider: "jev",
      sections: [sampleSection],
      result: {
        model: "jev-1.13.0",
        answers: {
          fit_overall: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          keyword_alignment: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          evidence_strength: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          wording: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          conciseness: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          structure: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          metrics: {
            type: "score",
            score: 3,
            legend: {},
            probabilities: { "3": 1 },
            confidence: 0.6,
          },
          req_r1_covered: { type: "noul", noul: 0.91 },
          req_r1_verdict: {
            type: "choice",
            choice: "works",
            probabilities: { works: 1 },
            confidence: 0.8,
          },
        },
      },
    });
    expect(review.mode).toBe("job");
    expect(review.requirements?.[0]?.verdict).toBe("works");
    expect(review.findings[0]?.severity).toBe("works");
    expect(review.jevScore.value).toBeGreaterThan(50);
  });
});

describe("MockJudgmentProvider", () => {
  it("returns an answer for every question id", async () => {
    const provider = new MockJudgmentProvider();
    const questions = buildGeneralReviewQuestions(["s1"]);
    const result = await provider.evaluate({
      state: { resume: { text: "Experience\n- Cut costs 20% with TypeScript" } },
      questions,
    });
    expect(provider.id).toBe("mock");
    expect(Object.keys(result.answers).sort()).toEqual(Object.keys(questions).sort());
    expect(result.answers.metrics?.type).toBe("score");
  });

  it("classifies repeated leadership verbs from the closed set", async () => {
    const provider = new MockJudgmentProvider();
    const questions = buildGeneralReviewQuestions([]);
    const result = await provider.evaluate({
      state: { resume: { text: "Led a team. Led hiring. Led on-call." } },
      questions,
    });
    expect(result.answers.leadership_repeat).toMatchObject({ type: "choice", choice: "repeated" });
  });
});

describe("TypeSafeHttpProvider", () => {
  it("POSTs SystemOne through the injected fetch", async () => {
    const provider = new TypeSafeHttpProvider({
      apiKey: "test-key",
      fetch: (async (input, init) => {
        expect(String(input)).toBe("https://api.typesafe.ai/v1/systemone");
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ model: "jev-latest", answers: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });
    const result = await provider.evaluate({ state: { ok: true }, questions: {} });
    expect(result.model).toBe("jev-latest");
  });

  it("does not invoke host fetch with the provider as this", async () => {
    const restore = installWorkerdStyleFetch();
    try {
      const provider = new TypeSafeHttpProvider({
        apiKey: "test-key",
        fetch: globalThis.fetch,
      });
      const result = await provider.evaluate({ state: { ok: true }, questions: {} });
      expect(result.model).toBe("jev-latest");
    } finally {
      restore();
    }
  });

  it("calls the global fetch as a method when no custom fetch is injected", async () => {
    const restore = installWorkerdStyleFetch();
    try {
      const provider = new TypeSafeHttpProvider({ apiKey: "test-key" });
      const result = await provider.evaluate({ state: { ok: true }, questions: {} });
      expect(result.model).toBe("jev-latest");
    } finally {
      restore();
    }
  });

  it("maps fetch throws to TypeSafeHttpError", async () => {
    const provider = new TypeSafeHttpProvider({
      apiKey: "test-key",
      fetch: (async () => {
        throw new TypeError("network down");
      }) as typeof fetch,
    });
    await expect(provider.evaluate({ state: { ok: true }, questions: {} })).rejects.toMatchObject({
      name: "TypeSafeHttpError",
      message: "TypeSafe SystemOne request failed: network down",
    } satisfies Partial<TypeSafeHttpError>);
  });
});

/**
 * workerd's host `fetch` rejects any receiver other than the global
 * (`TypeError: Illegal invocation`). Node's fetch does not, so tests mock that
 * branding check. See https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
 */
function installWorkerdStyleFetch(): () => void {
  const original = globalThis.fetch;
  function brandedFetch(
    this: unknown,
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> {
    if (this != null && this !== globalThis) {
      throw new TypeError(
        "Illegal invocation: function called with incorrect this reference",
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ model: "jev-latest", answers: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  globalThis.fetch = brandedFetch as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
