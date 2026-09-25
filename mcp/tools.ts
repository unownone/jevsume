import { MAX_RESUME_CHARS } from "../worker/engine.ts";
import { hasJobTarget, trimJobTarget, type JobTarget } from "../shared/job-target.ts";
import { isRateLimitErrorBody, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { compactReview, encodeToolJson } from "./compact.ts";
import { GENERAL_LENS_ID, getJobLens, listJobLenses, normalizeLensId, suggestJobLens } from "./catalog.ts";
import type { ReviewResponse } from "../packages/jev/types.ts";

export const MCP_TOOL_NAMES = [
  "list_job_lenses",
  "get_job_lens",
  "suggest_job_lens",
  "review_resume",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export type McpToolContent = {
  type: "text";
  text: string;
};

export type McpToolResult = {
  content: McpToolContent[];
  isError?: boolean;
};

export type McpReviewInput = {
  resumeText: string;
  jobLensId?: string;
  jobTarget?: JobTarget;
};

export type McpReviewOutcome =
  | { ok: true; review: ReviewResponse }
  | { ok: false; error: string; status?: number; rateLimit?: RateLimitErrorBody };

export type McpToolRuntime = {
  review: (input: McpReviewInput) => Promise<McpReviewOutcome>;
};

export type JsonSchema = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties: false;
};

export type McpToolDefinition = {
  name: McpToolName;
  description: string;
  inputSchema: JsonSchema;
};

function textResult(value: unknown, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : encodeToolJson(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function tooLarge(text: string): boolean {
  return text.length > MAX_RESUME_CHARS;
}

export function isMcpToolName(value: string): value is McpToolName {
  return (MCP_TOOL_NAMES as readonly string[]).includes(value);
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "list_job_lenses",
    description: "List baked-in job lenses (id, title, track, level, tags, blurb). No job text.",
    inputSchema: {
      type: "object",
      properties: {
        track: {
          type: "string",
          description: "Optional track such as engineering, product, or general",
        },
        query: { type: "string", description: "Optional substring filter on title, tags, or id" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_job_lens",
    description: "Fetch one baked-in job listing by id. Call only when you must quote the JD.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Lens id from list_job_lenses (default or preset:swe-staff)" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_job_lens",
    description: "Pick the closest baked-in lens for a resume. Returns one compact item.",
    inputSchema: {
      type: "object",
      properties: {
        resumeText: { type: "string", description: "Plain resume text" },
      },
      required: ["resumeText"],
      additionalProperties: false,
    },
  },
  {
    name: "review_resume",
    description:
      "Score a resume with Jev. Returns conformityScore and, when a job is attached, jobMatchScore plus expected, good-to-have, missing, available, and skill-gap sections.",
    inputSchema: {
      type: "object",
      properties: {
        resumeText: { type: "string", description: "Plain resume text" },
        jobLensId: {
          type: "string",
          description: "Baked-in lens id. Omit for the general professional lens.",
        },
        jobText: { type: "string", description: "Optional pasted job description; wins over jobLensId" },
        jobTitle: { type: "string" },
        company: { type: "string" },
        jobUrl: { type: "string" },
      },
      required: ["resumeText"],
      additionalProperties: false,
    },
  },
];

export function listMcpTools(): McpToolDefinition[] {
  return MCP_TOOLS;
}

async function callListJobLenses(args: Record<string, unknown>): Promise<McpToolResult> {
  const items = listJobLenses({
    track: readString(args.track),
    query: readString(args.query),
  });
  return textResult({ defaultId: GENERAL_LENS_ID, items });
}

async function callGetJobLens(args: Record<string, unknown>): Promise<McpToolResult> {
  const id = readString(args.id);
  if (!id) {
    return textResult({ error: "id is required" }, true);
  }
  const lens = getJobLens(id);
  if (!lens) {
    return textResult({ error: "Unknown job lens" }, true);
  }
  return textResult(lens);
}

async function callSuggestJobLens(args: Record<string, unknown>): Promise<McpToolResult> {
  const resumeText = readString(args.resumeText);
  if (!resumeText) {
    return textResult({ error: "resumeText is required" }, true);
  }
  if (tooLarge(resumeText)) {
    return textResult({ error: "resume text exceeds size limit" }, true);
  }
  return textResult(suggestJobLens(resumeText));
}

function jobTargetFromArgs(args: Record<string, unknown>): JobTarget | undefined {
  const target = trimJobTarget({
    jobText: readString(args.jobText),
    jobTitle: readString(args.jobTitle),
    company: readString(args.company),
    jobUrl: readString(args.jobUrl),
  });
  return hasJobTarget(target) ? target : undefined;
}

async function callReviewResume(
  args: Record<string, unknown>,
  runtime: McpToolRuntime,
): Promise<McpToolResult> {
  const resumeText = readString(args.resumeText);
  if (!resumeText) {
    return textResult({ error: "resumeText is required" }, true);
  }
  if (tooLarge(resumeText)) {
    return textResult({ error: "resume text exceeds size limit" }, true);
  }
  const jobTarget = jobTargetFromArgs(args);
  if (jobTarget?.jobText && tooLarge(jobTarget.jobText)) {
    return textResult({ error: "job text exceeds size limit" }, true);
  }
  const jobLensId = readString(args.jobLensId);
  const outcome = await runtime.review({
    resumeText,
    jobLensId: jobLensId ? normalizeLensId(jobLensId) : undefined,
    jobTarget,
  });
  if (!outcome.ok) {
    if (outcome.rateLimit && isRateLimitErrorBody(outcome.rateLimit)) {
      return textResult(outcome.rateLimit, true);
    }
    return textResult({ error: outcome.error }, true);
  }
  const compact = compactReview(outcome.review);
  if (!jobTarget && jobLensId) {
    const lens = getJobLens(jobLensId);
    if (lens) {
      compact.lens = { id: lens.id, title: lens.title };
    }
  }
  return textResult(compact);
}

export async function callMcpTool(
  name: string,
  args: unknown,
  runtime: McpToolRuntime,
): Promise<McpToolResult> {
  const record = isRecord(args) ? args : {};
  if (!isMcpToolName(name)) {
    return textResult({ error: `Unknown tool: ${name}` }, true);
  }
  switch (name) {
    case "list_job_lenses":
      return callListJobLenses(record);
    case "get_job_lens":
      return callGetJobLens(record);
    case "suggest_job_lens":
      return callSuggestJobLens(record);
    case "review_resume":
      return callReviewResume(record, runtime);
    default: {
      const _exhaustive: never = name;
      return textResult({ error: `Unknown tool: ${_exhaustive}` }, true);
    }
  }
}
