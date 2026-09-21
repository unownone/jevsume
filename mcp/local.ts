import { createProvider, ReviewEngine } from "../worker/engine.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { normalizeLensId } from "./catalog.ts";
import type { McpReviewOutcome, McpToolRuntime } from "./tools.ts";

export function localMcpRuntime(options: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  mock?: boolean;
}): McpToolRuntime {
  if (!options.mock && !options.apiKey) {
    throw new Error("Missing TypeSafe API key. Pass --api-key or set TYPESAFE_API_KEY.");
  }
  const engine = new ReviewEngine(
    createProvider({
      TYPESAFE_API_KEY: options.mock ? undefined : options.apiKey,
      TYPESAFE_BASE_URL: options.baseUrl,
      TYPESAFE_MODEL: options.model,
    }),
    createMemoryStores(),
  );
  return {
    review: async (input): Promise<McpReviewOutcome> => {
      const result = await engine.review(input.resumeText, input.jobLensId ? normalizeLensId(input.jobLensId) : undefined, {
        source: "mcp",
        jobTarget: input.jobTarget,
      });
      if ("error" in result) {
        return { ok: false, error: "Unknown job lens" };
      }
      return { ok: true, review: result };
    },
  };
}
