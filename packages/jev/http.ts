import type { JudgmentProvider, SystemOneRequest, SystemOneResult } from "./types.ts";

export type TypeSafeHttpConfig = {
  apiKey: string;
  baseURL?: string;
  model?: string;
  fetch?: typeof fetch;
};

export class TypeSafeHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TypeSafeHttpError";
    this.status = status;
  }
}

/**
 * Official TypeSafe HTTP API:
 * POST https://api.typesafe.ai/v1/systemone
 * https://docs.typesafe.ai/api.md
 */
export class TypeSafeHttpProvider implements JudgmentProvider {
  readonly id = "jev" as const;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TypeSafeHttpConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL ?? "https://api.typesafe.ai").replace(/\/$/, "");
    this.model = config.model ?? "jev-latest";
    this.fetchImpl = wrapFetch(config.fetch);
  }

  async evaluate(input: SystemOneRequest): Promise<SystemOneResult> {
    const url = `${this.baseURL}/v1/systemone`;
    const response = await this.dispatch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: input.state,
        model: input.model ?? this.model,
        questions: input.questions,
      }),
    });

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new TypeSafeHttpError(
        response.status,
        `TypeSafe SystemOne failed (${response.status}): ${detail}`,
      );
    }

    return (await response.json()) as SystemOneResult;
  }

  private async dispatch(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      throw new TypeSafeHttpError(0, `TypeSafe SystemOne request failed: ${detail}`);
    }
  }
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}

/**
 * workerd host `fetch` is a JSG method: calling it as `this.fetchImpl(url)`
 * passes the provider as `this` and throws
 * `TypeError: Illegal invocation: function called with incorrect this reference`.
 * Always invoke through a wrapper so the receiver is the global (or undefined,
 * which V8 promotes to the global proxy). Never return the raw host function.
 * https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
 */
function wrapFetch(custom?: typeof fetch): typeof fetch {
  if (custom) {
    return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      custom(input, init)) as typeof fetch;
  }
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    globalThis.fetch(input, init)) as typeof fetch;
}
