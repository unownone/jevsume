import {
  addUsage,
  applyL1Weights,
  assembleTree,
  buildHierarchyQuestions,
  buildJobReviewQuestions,
  buildPersonaQuestions,
  buildProctorReview,
  buildSectionQuestions,
  buildWeightQuestions,
  climbOverall,
  DEFAULT_PERSONA,
  DEFAULT_PERSONA_ID,
  emptyUsage,
  estimateInputCostUsd,
  MockJudgmentProvider,
  nodeWeightForScoring,
  personaBlurb,
  requirementsFromPersonaAnswers,
  replaceNode,
  rollUpParents,
  scoreHierarchyNode,
  scoringTargets,
  telemetryOf,
  transformJobReview,
  TypeSafeHttpProvider,
  usageFromResult,
} from "../packages/jev/index.ts";
import type {
  JobPersona,
  JsonValue,
  JudgmentProvider,
  ProctorEvent,
  Questions,
  ReviewFinding,
  ReviewResponse,
  ReviewSuggestion,
  SystemOneRequest,
  SystemOneResult,
  UsageTotals,
} from "../packages/jev/types.ts";
import {
  composeJobDescription,
  hasJobTarget,
  jobTargetLabel,
  trimJobTarget,
  type JobTarget,
} from "../shared/job-target.ts";
import { buildProctorBlocks, extractRequirementCandidates, groupResumeText } from "./ats/group.ts";
import { hashJson, sha256Hex } from "./storage/hash.ts";
import type {
  EvalKind,
  PersonaListFilter,
  ReviewStores,
  StoredEvalRun,
  StoredResume,
  StorageKind,
} from "./storage/types.ts";

export type JobPersonaCatalogItem = {
  id: string;
  title: string;
  tags: string[];
  isDefault: boolean;
  summary: string;
  explanation: string;
  requirementCount: number;
  createdAt: string;
  jobDescription?: string;
};

function catalogFromDefault(includeDescription = false): JobPersonaCatalogItem {
  const item: JobPersonaCatalogItem = {
    id: DEFAULT_PERSONA.id,
    title: DEFAULT_PERSONA.title,
    tags: [...DEFAULT_PERSONA.tags],
    isDefault: true,
    summary: DEFAULT_PERSONA.summary,
    explanation: DEFAULT_PERSONA.explanation,
    requirementCount: 0,
    createdAt: DEFAULT_PERSONA.createdAt,
  };
  if (includeDescription) {
    item.jobDescription = DEFAULT_PERSONA.jobDescription;
  }
  return item;
}

function catalogFromStored(persona: JobPersona, includeDescription = false): JobPersonaCatalogItem {
  const blurb = personaBlurb(persona);
  const item: JobPersonaCatalogItem = {
    id: persona.id,
    title: persona.title,
    tags: persona.tags,
    isDefault: false,
    summary: blurb.summary,
    explanation: blurb.explanation,
    requirementCount: persona.requirements.length,
    createdAt: persona.createdAt,
  };
  if (includeDescription) {
    item.jobDescription = persona.jobDescription;
  }
  return item;
}

function personaFromJobTarget(input: JobTarget): JobPersona {
  const target = trimJobTarget(input);
  const jobDescription = composeJobDescription(target);
  const title = target.jobTitle || jobTargetLabel(target);
  const lines = extractRequirementCandidates(jobDescription);
  return {
    id: JOB_TARGET_PERSONA_ID,
    title,
    tags: target.company ? [target.company] : [],
    jobDescription,
    requirements: lines.map((text, index) => ({
      id: `r${index + 1}`,
      text,
      category: "must_have" as const,
      noul: 0.7,
    })),
    createdAt: new Date().toISOString(),
  };
}

function telemetryFrom(result: SystemOneResult, serverMs: number) {
  const inputTokens = result.usage?.input_tokens ?? 0;
  const outputTokens = result.usage?.output_tokens ?? 0;
  return {
    serverMs,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: estimateInputCostUsd(inputTokens),
    requestCount: 1,
  };
}

export const MAX_RESUME_CHARS = 120_000;

export type EngineBindings = {
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  TYPESAFE_MODEL?: string;
};

export type ResumeMeta = {
  filename?: string;
  source?: string;
  jobTarget?: JobTarget;
};

export const JOB_TARGET_PERSONA_ID = "job-target";

export type PersistedReview = ReviewResponse & {
  id: string;
  resumeId: string;
  personaId?: string;
};

export class ReviewEngine {
  constructor(
    private readonly provider: JudgmentProvider,
    private readonly stores: ReviewStores,
  ) {}

  providerId(): JudgmentProvider["id"] {
    return this.provider.id;
  }

  storageKind(): StorageKind {
    return this.stores.kind;
  }

  async persistResume(input: {
    text: string;
    filename?: string;
    source?: string;
  }): Promise<StoredResume & { sections: ReturnType<typeof groupResumeText>["sections"] }> {
    const grouped = groupResumeText(input.text);
    const contentHash = await sha256Hex(grouped.text);
    const existing = await this.stores.resumes.getByHash(contentHash);
    if (existing) {
      return { ...existing, sections: grouped.sections };
    }
    const stored: StoredResume = {
      id: crypto.randomUUID(),
      text: grouped.text,
      filename: input.filename,
      source: input.source,
      contentHash,
      charCount: grouped.text.length,
      createdAt: new Date().toISOString(),
    };
    await this.stores.resumes.put(stored);
    return { ...stored, sections: grouped.sections };
  }

  getResume(id: string): Promise<StoredResume | null> {
    return this.stores.resumes.get(id);
  }

  listResumes(filter?: { q?: string; source?: string; limit?: number }): Promise<StoredResume[]> {
    return this.stores.resumes.list(filter);
  }

  async createPersona(input: {
    title: string;
    jobDescription: string;
    tags?: string[];
  }): Promise<JobPersona> {
    const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
    const lines = extractRequirementCandidates(input.jobDescription);
    const candidates = lines.map((text, index) => ({ id: `r${index + 1}`, text }));
    const request: SystemOneRequest = {
      state: {
        job: {
          title: input.title,
          tags,
          description: input.jobDescription,
        },
        candidates,
      },
      questions: buildPersonaQuestions(candidates.length),
    };
    const result = await this.provider.evaluate(request);
    const requirements = requirementsFromPersonaAnswers({
      candidates,
      answers: result.answers,
    });
    const persona: JobPersona = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      tags,
      jobDescription: input.jobDescription,
      requirements,
      createdAt: new Date().toISOString(),
    };
    await this.stores.personas.put(persona);
    await this.persistEval({
      kind: "persona_build",
      resumeId: null,
      personaId: persona.id,
      request,
      result,
      review: null,
      jevScore: null,
    });
    return persona;
  }

  getPersona(id: string): Promise<JobPersona | null> {
    return this.stores.personas.get(id);
  }

  listPersonas(filter?: PersonaListFilter): Promise<JobPersona[]> {
    return this.stores.personas.list(filter);
  }

  async listJobPersonas(): Promise<JobPersonaCatalogItem[]> {
    const stored = await this.stores.personas.list();
    return [catalogFromDefault(), ...stored.map((persona) => catalogFromStored(persona))];
  }

  async getJobPersona(id: string): Promise<JobPersonaCatalogItem | null> {
    if (id === DEFAULT_PERSONA_ID) {
      return catalogFromDefault(true);
    }
    const persona = await this.stores.personas.get(id);
    if (!persona) {
      return null;
    }
    return catalogFromStored(persona, true);
  }

  getEval(id: string): ReturnType<ReviewStores["evals"]["get"]> {
    return this.stores.evals.get(id);
  }

  listEvals(filter?: Parameters<ReviewStores["evals"]["list"]>[0]): ReturnType<ReviewStores["evals"]["list"]> {
    return this.stores.evals.list(filter);
  }

  async review(
    resumeText: string,
    personaId?: string,
    meta?: ResumeMeta,
  ): Promise<PersistedReview | { error: "not_found" }> {
    if (hasJobTarget(meta?.jobTarget)) {
      return this.jobTargetReview(resumeText, meta?.jobTarget as JobTarget, meta);
    }
    if (!personaId || personaId === DEFAULT_PERSONA_ID) {
      return this.generalReview(resumeText, meta);
    }
    return this.jobReview(resumeText, personaId, meta);
  }

  private async evaluate(input: SystemOneRequest): Promise<{ result: SystemOneResult; serverMs: number }> {
    const started = performance.now();
    const result = await this.provider.evaluate(input);
    return { result, serverMs: Math.max(0, Math.round(performance.now() - started)) };
  }

  async *streamReview(
    resumeText: string,
    personaId?: string,
    meta?: ResumeMeta,
  ): AsyncGenerator<ProctorEvent> {
    if (hasJobTarget(meta?.jobTarget)) {
      yield* this.streamProctorReview(resumeText, meta, personaFromJobTarget(meta?.jobTarget as JobTarget));
      return;
    }
    if (personaId && personaId !== DEFAULT_PERSONA_ID) {
      const persona = await this.stores.personas.get(personaId);
      if (!persona) {
        yield { type: "error", message: "Persona not found" };
        return;
      }
      yield* this.streamProctorReview(resumeText, meta, persona);
      return;
    }
    yield* this.streamProctorReview(resumeText, meta);
  }

  async *streamProctorReview(
    resumeText: string,
    meta?: ResumeMeta,
    persona?: JobPersona,
  ): AsyncGenerator<ProctorEvent> {
    const started = performance.now();
    let usage: UsageTotals = emptyUsage();
    const stored = await this.persistResume({
      text: resumeText,
      filename: meta?.filename,
      source: meta?.source ?? "review",
    });
    const grouped = groupResumeText(resumeText);
    const blocks = buildProctorBlocks(resumeText);
    const jobTarget = hasJobTarget(meta?.jobTarget) ? trimJobTarget(meta?.jobTarget) : undefined;
    const jobState = persona
      ? {
          title: persona.title,
          tags: persona.tags,
          jobDescription: persona.jobDescription,
          jobUrl: jobTarget?.jobUrl ?? "",
          company: jobTarget?.company ?? "",
          requirements: persona.requirements,
        }
      : undefined;
    const jobListing = persona
      ? {
          title: persona.title,
          company: jobTarget?.company ?? "",
          url: jobTarget?.jobUrl ?? "",
          description: persona.jobDescription,
        }
      : undefined;
    const hierarchyRequest: SystemOneRequest = {
      state:
        jobState && jobListing
          ? { resume: grouped, blocks, persona: jobState, job: jobListing }
          : { resume: grouped, blocks },
      questions: buildHierarchyQuestions(blocks),
    };
    const hierarchyEval = await this.evaluate(hierarchyRequest);
    usage = addUsage(usage, usageFromResult(hierarchyEval.result));
    await this.persistEval({
      kind: "general_review",
      resumeId: stored.id,
      personaId: persona && persona.id !== JOB_TARGET_PERSONA_ID ? persona.id : null,
      request: hierarchyRequest,
      result: hierarchyEval.result,
      review: null,
      jevScore: null,
    });
    let roots = assembleTree(blocks, hierarchyEval.result.answers);
    const ms = () => Math.max(0, Math.round(performance.now() - started));
    yield { type: "hierarchy", roots, telemetry: telemetryOf(usage, ms()) };

    const l1 = roots.filter((node) => node.level === 1);
    const weightRequest: SystemOneRequest = {
      state:
        jobState && jobListing
          ? {
              resume: grouped,
              sections: l1.map((node) => ({ id: node.id, kind: node.kind, title: node.title, text: node.text })),
              persona: jobState,
              job: jobListing,
            }
          : {
              resume: grouped,
              sections: l1.map((node) => ({ id: node.id, kind: node.kind, title: node.title, text: node.text })),
            },
      questions: buildWeightQuestions(l1),
    };
    const weightEval = await this.evaluate(weightRequest);
    usage = addUsage(usage, usageFromResult(weightEval.result));
    await this.persistEval({
      kind: "general_review",
      resumeId: stored.id,
      personaId: persona && persona.id !== JOB_TARGET_PERSONA_ID ? persona.id : null,
      request: weightRequest,
      result: weightEval.result,
      review: null,
      jevScore: null,
    });
    roots = applyL1Weights(roots, weightEval.result.answers);
    yield { type: "weights", roots, telemetry: telemetryOf(usage, ms()) };

    const suggestions: ReviewSuggestion[] = [];
    const findings: ReviewFinding[] = [];
    const targets = scoringTargets(roots);
    const scored = await Promise.all(
      targets.map(async (node) => {
        const path = `\`node.text\` of section “${node.title}”`;
        const request: SystemOneRequest = {
          state:
            jobState && jobListing
              ? {
                  node: { id: node.id, kind: node.kind, title: node.title, text: node.text },
                  resume: { text: grouped.text },
                  persona: jobState,
                  job: jobListing,
                }
              : {
                  node: { id: node.id, kind: node.kind, title: node.title, text: node.text },
                  resume: { text: grouped.text },
                },
          questions: buildSectionQuestions(node.kind, node.id, path),
        };
        const evaluated = await this.evaluate(request);
        return { node, request, evaluated };
      }),
    );

    for (const item of scored) {
      usage = addUsage(usage, usageFromResult(item.evaluated.result));
      await this.persistEval({
        kind: "general_review",
        resumeId: stored.id,
        personaId: persona && persona.id !== JOB_TARGET_PERSONA_ID ? persona.id : null,
        request: item.request,
        result: item.evaluated.result,
        review: null,
        jevScore: null,
      });
      const weight = nodeWeightForScoring(roots, item.node);
      const scoredNode = scoreHierarchyNode(item.node, item.evaluated.result.answers, weight);
      roots = rollUpParents(replaceNode(roots, scoredNode.node));
      suggestions.push(...scoredNode.suggestions);
      findings.push(...scoredNode.findings);
      yield {
        type: "section",
        node: scoredNode.node,
        overall: climbOverall(roots),
        suggestions: scoredNode.suggestions,
        findings: scoredNode.findings,
        telemetry: telemetryOf(usage, ms()),
      };
    }

    const review = buildProctorReview({
      roots,
      provider: this.provider.id,
      resumeText: grouped.text,
      telemetry: telemetryOf(usage, ms()),
      suggestions,
      findings,
      persona,
      mode: persona ? "job" : "general",
      model: hierarchyEval.result.model,
      jobTarget,
    });
    const evalRun = await this.persistEval({
      kind: persona ? "job_review" : "general_review",
      resumeId: stored.id,
      personaId: persona && persona.id !== JOB_TARGET_PERSONA_ID ? persona.id : null,
      request: hierarchyRequest,
      result: hierarchyEval.result,
      review,
      jevScore: review.jevScore.value,
    });
    yield {
      type: "complete",
      review: { ...review, id: evalRun.id, resumeId: stored.id, personaId: persona?.id },
    };
  }

  async generalReview(resumeText: string, meta?: ResumeMeta): Promise<PersistedReview> {
    let complete: PersistedReview | null = null;
    for await (const event of this.streamProctorReview(resumeText, meta)) {
      if (event.type === "complete") {
        complete = event.review as PersistedReview;
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
    if (!complete) {
      throw new Error("Proctor review did not complete");
    }
    return complete;
  }

  async jobReview(
    resumeText: string,
    personaId: string,
    meta?: ResumeMeta,
  ): Promise<PersistedReview | { error: "not_found" }> {
    const persona = await this.stores.personas.get(personaId);
    if (!persona) {
      return { error: "not_found" };
    }
    return this.runJobReview(resumeText, persona, meta);
  }

  async jobTargetReview(
    resumeText: string,
    jobTarget: JobTarget,
    meta?: ResumeMeta,
  ): Promise<PersistedReview> {
    const target = trimJobTarget(jobTarget);
    const persona = personaFromJobTarget(target);
    let complete: PersistedReview | null = null;
    for await (const event of this.streamProctorReview(resumeText, { ...meta, jobTarget: target }, persona)) {
      if (event.type === "complete") {
        complete = event.review as PersistedReview;
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
    if (!complete) {
      throw new Error("Proctor review did not complete");
    }
    return complete;
  }

  private async runJobReview(
    resumeText: string,
    persona: JobPersona,
    meta?: ResumeMeta,
  ): Promise<PersistedReview> {
    const stored = await this.persistResume({
      text: resumeText,
      filename: meta?.filename,
      source: meta?.source ?? "review",
    });
    const grouped = groupResumeText(resumeText);
    const jobTarget = hasJobTarget(meta?.jobTarget) ? trimJobTarget(meta?.jobTarget) : undefined;
    const request: SystemOneRequest = {
      state: {
        persona: {
          title: persona.title,
          tags: persona.tags,
          jobDescription: persona.jobDescription,
          jobUrl: jobTarget?.jobUrl ?? "",
          company: jobTarget?.company ?? "",
          requirements: persona.requirements,
        },
        job: {
          title: persona.title,
          company: jobTarget?.company ?? "",
          url: jobTarget?.jobUrl ?? "",
          description: persona.jobDescription,
        },
        resume: grouped,
      },
      questions: buildJobReviewQuestions(
        persona.requirements.map((requirement) => requirement.id),
        grouped.sections.map((section) => section.id),
      ),
    };
    const { result, serverMs } = await this.evaluate(request);
    const review = transformJobReview({
      result,
      persona,
      sections: grouped.sections,
      provider: this.provider.id,
      resumeText: grouped.text,
      telemetry: telemetryFrom(result, serverMs),
      jobTarget,
    });
    const evalRun = await this.persistEval({
      kind: "job_review",
      resumeId: stored.id,
      personaId: persona.id === JOB_TARGET_PERSONA_ID ? null : persona.id,
      request,
      result,
      review,
      jevScore: review.jevScore.value,
    });
    return { ...review, id: evalRun.id, resumeId: stored.id, personaId: persona.id };
  }

  private async persistEval(input: {
    kind: EvalKind;
    resumeId: string | null;
    personaId: string | null;
    request: { state: JsonValue; questions: Questions };
    result: SystemOneResult;
    review: ReviewResponse | null;
    jevScore: number | null;
  }): Promise<StoredEvalRun> {
    const run: StoredEvalRun = {
      id: crypto.randomUUID(),
      kind: input.kind,
      resumeId: input.resumeId,
      personaId: input.personaId,
      provider: this.provider.id,
      model: input.result.model,
      jevScore: input.jevScore,
      promptHash: await hashJson(input.request.questions),
      input: input.request.state,
      prompt: input.request.questions,
      output: input.result,
      review: input.review,
      usageInputTokens: input.result.usage?.input_tokens ?? null,
      usageOutputTokens: input.result.usage?.output_tokens ?? null,
      createdAt: new Date().toISOString(),
    };
    return this.stores.evals.put(run);
  }
}

export function createProvider(env: EngineBindings, fetchImpl?: typeof fetch): JudgmentProvider {
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    return new MockJudgmentProvider();
  }
  return new TypeSafeHttpProvider({
    apiKey,
    baseURL: env.TYPESAFE_BASE_URL,
    model: env.TYPESAFE_MODEL,
    fetch: fetchImpl,
  });
}
