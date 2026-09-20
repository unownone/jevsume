import { formatDurationMs, formatReviewCost } from "../../shared/format.ts";

type ReviewMetaProps = {
  clientMs: number;
  serverMs: number;
  inputTokens: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd: number;
  requestCount?: number;
};

export function ReviewMeta({
  clientMs,
  serverMs,
  inputTokens,
  outputTokens,
  totalTokens,
  costUsd,
  requestCount,
}: ReviewMetaProps) {
  return (
    <footer className="review-meta" aria-label="Review timing and cost">
      <span>
        Overall <strong>{formatDurationMs(clientMs)}</strong>
      </span>
      <span>
        Jev <strong>{formatDurationMs(serverMs)}</strong>
      </span>
      <span>
        Input tokens <strong>{Math.round(inputTokens).toLocaleString("en-US")}</strong>
      </span>
      {outputTokens !== undefined ? (
        <span>
          Output tokens <strong>{Math.round(outputTokens).toLocaleString("en-US")}</strong>
        </span>
      ) : null}
      {totalTokens !== undefined ? (
        <span>
          Total tokens <strong>{Math.round(totalTokens).toLocaleString("en-US")}</strong>
        </span>
      ) : null}
      {requestCount !== undefined ? (
        <span>
          Jev requests <strong>{requestCount}</strong>
        </span>
      ) : null}
      <span>
        Est. cost <strong>{formatReviewCost(costUsd)}</strong>
      </span>
    </footer>
  );
}
