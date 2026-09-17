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
    const response = await this.fetchImpl(url, {
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
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}

/**
 * workerd host `fetch` throws Illegal invocation if it is stored and called
 * later as a free function. Always invoke it with the Worker global as `this`.
 */
function wrapFetch(custom?: typeof fetch): typeof fetch {
  if (custom) {
    return custom;
  }
  const impl = globalThis.fetch.bind(globalThis);
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    impl(input, init)) as typeof fetch;
}
