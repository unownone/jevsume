import { estimateInputCostUsd } from "./cost.ts";
import type { ReviewTelemetry, SystemOneResult, UsageTotals } from "./types.ts";

export function emptyUsage(): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    requestCount: 0,
  };
}

export function usageFromResult(result: SystemOneResult): UsageTotals {
  const inputTokens = result.usage?.input_tokens ?? 0;
  const outputTokens = result.usage?.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: estimateInputCostUsd(inputTokens),
    requestCount: 1,
  };
}

export function addUsage(left: UsageTotals, right: UsageTotals): UsageTotals {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    costUsd: left.costUsd + right.costUsd,
    requestCount: left.requestCount + right.requestCount,
  };
}

export function telemetryOf(usage: UsageTotals, serverMs: number): ReviewTelemetry {
  return {
    serverMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    costUsd: usage.costUsd,
    requestCount: usage.requestCount,
  };
}
