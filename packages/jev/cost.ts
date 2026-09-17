export const INPUT_TOKEN_USD_PER_MILLION = 0.042;

export function estimateInputCostUsd(inputTokens: number): number {
  if (!Number.isFinite(inputTokens) || inputTokens <= 0) {
    return 0;
  }
  return (inputTokens / 1_000_000) * INPUT_TOKEN_USD_PER_MILLION;
}
